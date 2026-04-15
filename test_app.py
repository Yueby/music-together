from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    
    try:
        page.goto('http://localhost:5174')
        page.wait_for_load_state('networkidle')
        
        btn = page.locator("button:has-text('创建房间')").first
        btn.click()
        
        nick_input = page.locator("input[placeholder*='昵称']").first
        nick_input.wait_for(state='visible')
        nick_input.fill("TestUser")
        
        create_btn = page.locator("button:has-text('创建房间')").last
        create_btn.click()
            
        page.wait_for_load_state('networkidle')
        
        # Add a song
        search_btn = page.locator("button:has(.lucide-search)")
        if search_btn.count() > 0:
            search_btn.click()
            search_input = page.locator("input[placeholder*='搜索']")
            search_input.wait_for(state='visible')
            search_input.fill("起风了")
            page.keyboard.press("Enter")
            # Wait for search results to appear
            page.locator("button[aria-label*='添加']").first.wait_for(state='visible', timeout=10000)
            page.screenshot(path='/workspace/search_results.png', full_page=True)
            
            # Now click Add
            add_btns = page.locator("button[aria-label*='添加']")
            if add_btns.count() > 0:
                add_btns.first.click()
            page.keyboard.press("Escape")
            
        # Open queue
        queue_btn = page.locator("button[aria-label*='播放列表'], button:has(.lucide-list-music)")
        if queue_btn.count() > 0:
            queue_btn.first.click()
            page.screenshot(path='/workspace/queue_final.png', full_page=True)
            print("Queue opened and screenshot saved!")
            
    except Exception as e:
        print(f"Exception: {e}")
    finally:
        browser.close()
