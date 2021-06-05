import { bgRedBright, whiteBright } from "chalk";
import Debug from "debug";
import { tmpdir } from "os";
import * as path from "path";
import puppeteer, { Browser } from "puppeteer-core";
import { Worker } from 'worker_threads';
import { loadConfiguration, QueueEntry } from "./configuration";
import { SOUND_BASE64 } from "./sound.base64";
import { sendTelegramMessage } from "./telegram";
Debug.enable("impftermin:*");
const debug = Debug("impftermin:main");

debug("Launching Impftermin");

async function downloadBrowser(): Promise<string> {
  const tmpPath = tmpdir();
  const chromePath = path.resolve(path.join(tmpPath, ".local-chromium"));

  debug("Downloading Chromium...");
  const browserFetcher = (puppeteer as any).createBrowserFetcher({
    path: chromePath,
  });
  const revisionInfo = await browserFetcher.download(
    (puppeteer as any)._preferredRevision // use an older revision!
  );
  debug("Download successful.");
  return revisionInfo.executablePath;
}

async function runService(entry: QueueEntry, executablePath: string, intervalInMinutes: number): Promise<void> {
    new Worker(path.resolve(__dirname, 'service.js'), { workerData: {entry, executablePath, intervalInMinutes} });
}

async function run() {
  const executablePath = await downloadBrowser();
  const configuration = await loadConfiguration();
  const promises: Array<Promise<void>> = [];
  promises.push(runService(configuration.queue[1], executablePath, configuration.intervalInMinutes));
  configuration.queue.forEach(entry => {
    setTimeout(() => promises.push(runService(entry, executablePath, configuration.intervalInMinutes)), 5000);
  });
  await Promise.all(promises);
}

run().catch(err => console.error(err))