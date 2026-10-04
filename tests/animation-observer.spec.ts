import {test,expect} from '@playwright/test'
import {observeOpeningAnimation,expectOpeningAnimation} from './dialogAnimation'
test.use({reducedMotion:'no-preference'})
for(const transition of ['none','opacity 700ms linear, transform 700ms linear'])test(`opening assertion rejects ${transition}`,async({page})=>{
 await page.goto('./');const modal=page.locator('dialog');await observeOpeningAnimation(modal)
 await page.addStyleTag({content:`.landing .status-dialog {transition:${transition}!important}`})
 await page.getByRole('button',{name:'ดาวน์โหลด',exact:true}).first().click();await expect(modal).toHaveAttribute('open','')
 await expect(async()=>{await expectOpeningAnimation(modal,1200)}).rejects.toThrow('Real opacity/transform transitions')
 if(transition==='none')expect(JSON.parse((await modal.getAttribute('data-test-opening-animation'))!).runs).toEqual([])
 else expect(JSON.parse((await modal.getAttribute('data-test-opening-animation'))!).runs.some((r:{durations:number[]})=>r.durations.includes(700))).toBe(true)
})
