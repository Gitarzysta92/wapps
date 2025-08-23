import 'zone.js';
import { bootstrapApplication } from "@angular/platform-browser";
import { join } from "node:path";
import { CommonEngine } from "@angular/ssr/node";
import { mergeApplicationConfig } from "@angular/core";
import { appConfigSSR } from "./app-config.ssr";
import { state } from '../web-client/state';
import { provideIdentityAspect } from '../../aspects/identity/identity.providers';
import { IdentityService } from '../../features/identity/login/application/identity.service';
import { RenderingServer } from './rendering-server';


const commonEngine = new CommonEngine();
const renderingServer = new RenderingServer({
  publicDir: join(process.cwd(), 'dist/web-client/browser'),
  index: 'index.html',
});

const appConfig = mergeApplicationConfig(
  createAppConfig({
    routes: routes,
    state: state,
    effects: [],
    metareducers: []
  }),
  provideIdentityAspect(IdentityService),
  appConfigSSR,
) 

renderingServer.onRenderRequest((req, cfg) => {
  console.log(cfg.index);
  return commonEngine
    .render({
      bootstrap: () => bootstrapApplication(AppRootComponent, appConfig),
      documentFilePath: cfg.index,
      url: `${req.protocol}://${req.headers.host}${req.originalUrl}`,
      publicPath: cfg.staticDir,
      providers: [],
    })
})

const port = (process.env['PORT'] ?? 4000) as number;
renderingServer.start({ port });  