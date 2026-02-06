import 'zone.js/node';
import { bootstrapApplication } from '@angular/platform-browser';
import { join } from 'node:path';
import { CommonEngine } from '@angular/ssr/node';
import { mergeApplicationConfig } from '@angular/core';
import { appConfigSSR } from './app-config.ssr';
import { RenderingServer } from './rendering-server';
import {
  AppRootComponent,
  createAppConfig,
  routes,
} from '@portals/aggregator/application';

const staticDir = join(process.cwd(), 'browser');

const commonEngine = new CommonEngine();
const renderingServer = new RenderingServer({
  staticDir,
  index: 'index.html',
});

const appConfig = mergeApplicationConfig(
  createAppConfig({ routes }),
  appConfigSSR
);

renderingServer.onRenderRequest((req, cfg) => {
  return commonEngine
    .render({
      bootstrap: () => bootstrapApplication(AppRootComponent, appConfig),
      documentFilePath: cfg.index,
      url: `${req.protocol}://${req.headers.host}${req.originalUrl}`,
      publicPath: cfg.staticDir,
      providers: [],
    })
})

const port = Number.parseInt(process.env['PORT'] ?? '4000', 10);
renderingServer.start({ port });  
