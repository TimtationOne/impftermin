import { bgRedBright, whiteBright } from "chalk";
import Debug from "debug";
import { workerData } from 'worker_threads';
import { QueueEntry } from "./configuration";
import { SOUND_BASE64 } from "./sound.base64";
import { sendTelegramMessage } from "./telegram";
import { checkForUrlWithCode } from "./zentrum";
import { tmpdir } from "os";
import * as path from "path";
import puppeteer, { Browser } from "puppeteer-core";
Debug.enable("impftermin:*");
const debug = Debug("impftermin:main");


export const coloredError = (...text: unknown[]) =>
  bgRedBright(whiteBright(...text));

console.log('Started a worker');


(async () => {
  const entry: QueueEntry = workerData.entry;

  debug("Started new Worker for: " + entry.url);

  const getNextCheckTime = () => {
    const date = new Date();

    const nextDate = new Date(
      date.getTime() + workerData.intervalInMinutes * 60000
    );

    return `${nextDate.getHours()}:${(nextDate.getMinutes() < 10 ? "0" : "") + nextDate.getMinutes()
      }`;
  };


  const browser: Browser = await puppeteer.launch({
    executablePath: workerData.executablePath,
    headless: false,
  });

  const page = (await browser.pages())[0];
  await page.waitForTimeout(3000);



  const runChecks = async () => {

    if (await checkForUrlWithCode(page, entry.url, entry.code)) {
      // appointments available!!!
      if (entry.code) {
        sendTelegramMessage(`Appointments available at ${entry.url} with code ${entry.code} !!!!!`);
      } else {
        sendTelegramMessage(`Codes available at ${entry.url} !!!!!`);
      }

      await page.addScriptTag({
        content: `new Audio("data:audio/wav;base64,${SOUND_BASE64}").play();`,
      });
      // stop scraper for 25 minutes after a hit
      setTimeout(() => runChecks(), 1000 * 60 * 25);
      return;
    }
    
    // clear cookies
    const client = await page.target().createCDPSession();
    await client.send('Network.clearBrowserCookies');
    await client.send('Network.clearBrowserCache');

    setTimeout(() => runChecks(), 1000 * 60 * workerData.intervalInMinutes);
    debug(
      `Next check in ${workerData.intervalInMinutes
      } minutes (at ${getNextCheckTime()})`
    );

  };
  await runChecks(); 
})(); 
