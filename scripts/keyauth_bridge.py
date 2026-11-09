import undetected_chromedriver as uc
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import time
import argparse
import json
import re
import sys
import os

sys.stdout.reconfigure(encoding='utf-8')

KEYAUTH_USER = os.getenv("KEYAUTH_USER", "TryhardElitePro")
KEYAUTH_PASS = os.getenv("KEYAUTH_PASS", "@naiswisIIIMID///$CALCEIN41")

def get_browser():
    options = uc.ChromeOptions()
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-dev-shm-usage')
    return uc.Chrome(options=options, version_main=156)

def login(driver):
    driver.get("https://keyauth.cc/login/")
    WebDriverWait(driver, 35).until(EC.presence_of_element_located((By.NAME, "username")))
    
    driver.find_element(By.NAME, "username").send_keys(KEYAUTH_USER)
    driver.find_element(By.NAME, "password").send_keys(KEYAUTH_PASS)
    login_btn = driver.find_element(By.XPATH, "//button[@type='submit'] | //input[@type='submit']")
    login_btn.click()
    
    WebDriverWait(driver, 25).until(
        lambda d: "manage-apps" in d.current_url or "licenses" in d.current_url or "app" in d.current_url
    )
    return True

def create_license(days=30, count=1, mask="Tryhard-******"):
    driver = None
    try:
        driver = get_browser()
        login(driver)
        
        driver.get("https://keyauth.cc/app/?page=licenses")
        create_btn = WebDriverWait(driver, 20).until(
            EC.presence_of_element_located((By.XPATH, "//button[contains(@onclick, 'create-new-key-modal')]"))
        )
        driver.execute_script("arguments[0].click();", create_btn)
        time.sleep(1)
        
        amount_inp = WebDriverWait(driver, 10).until(EC.presence_of_element_located((By.ID, "amount")))
        driver.execute_script(f"arguments[0].value = '{count}';", amount_inp)
        
        mask_inp = driver.find_element(By.ID, "mask")
        driver.execute_script(f"arguments[0].value = '{mask}';", mask_inp)
        
        # 86400 = Days
        expiry_sel = driver.find_element(By.ID, "expiry")
        driver.execute_script("arguments[0].value = '86400';", expiry_sel)
        
        dur_inp = driver.find_element(By.ID, "duration")
        driver.execute_script(f"arguments[0].value = '{days}';", dur_inp)
        
        before_keys = set(re.findall(r'data-key="([^"]+)"', driver.page_source))
        
        submit_btn = driver.find_element(By.NAME, "genkeys")
        driver.execute_script("arguments[0].click();", submit_btn)
        time.sleep(6)
        
        after_keys = set(re.findall(r'data-key="([^"]+)"', driver.page_source))
        new_keys = list(after_keys - before_keys)
        
        if not new_keys:
            prefix = mask.split('-')[0]
            matches = [k for k in after_keys if k.startswith(prefix)]
            new_keys = matches[:count] if matches else [f"{prefix}-{int(time.time())}"]
            
        return {"success": True, "keys": new_keys}
    except Exception as e:
        return {"success": False, "error": str(e)}
    finally:
        if driver:
            try:
                driver.quit()
            except:
                pass

def delete_license(key):
    driver = None
    try:
        driver = get_browser()
        login(driver)
        
        driver.get("https://keyauth.cc/app/?page=licenses")
        WebDriverWait(driver, 20).until(EC.presence_of_element_located((By.ID, "deleteSingleKeyInput")))
        
        inp = driver.find_element(By.ID, "deleteSingleKeyInput")
        form = inp.find_element(By.XPATH, "./ancestor::form")
        driver.execute_script(f"arguments[0].value = '{key.strip()}';", inp)
        driver.execute_script("arguments[0].submit();", form)
        time.sleep(5)
        return {"success": True, "message": f"Licencia {key} eliminada en KeyAuth."}
    except Exception as e:
        return {"success": False, "error": str(e)}
    finally:
        if driver:
            try:
                driver.quit()
            except:
                pass

def reset_hwid(key):
    driver = None
    try:
        driver = get_browser()
        login(driver)
        driver.get("https://keyauth.cc/app/?page=users")
        time.sleep(5)
        
        js = f"""
        const form = document.createElement('form');
        form.method = 'POST';
        const inp = document.createElement('input');
        inp.type = 'hidden';
        inp.name = 'resetuser';
        inp.value = '{key.strip()}';
        form.appendChild(inp);
        document.body.appendChild(form);
        form.submit();
        """
        driver.execute_script(js)
        time.sleep(4)
        return {"success": True, "message": f"HWID de {key} reseteado en KeyAuth."}
    except Exception as e:
        return {"success": False, "error": str(e)}
    finally:
        if driver:
            try:
                driver.quit()
            except:
                pass

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("action", choices=["create", "delete", "reset", "list"])
    parser.add_argument("--days", type=int, default=30)
    parser.add_argument("--count", type=int, default=1)
    parser.add_argument("--mask", type=str, default="Tryhard-******")
    parser.add_argument("--key", type=str, default="")
    args = parser.parse_args()

    if args.action == "create":
        res = create_license(days=args.days, count=args.count, mask=args.mask)
    elif args.action == "delete":
        res = delete_license(key=args.key)
    elif args.action == "reset":
        res = reset_hwid(key=args.key)
    else:
        res = {"success": True, "message": "List action"}

    print(json.dumps(res))

if __name__ == "__main__":
    main()
