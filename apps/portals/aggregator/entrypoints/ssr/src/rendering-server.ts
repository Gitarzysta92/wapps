import express, { Application } from 'express';

export interface IRenderingServerConfiguration {
  staticDir: string;
  index: string;
}

// What are benefits of this compared to the AngularUniversal.
export class RenderingServer {
  private _express: Application;

  constructor(
    private readonly _cfg: IRenderingServerConfiguration
  ) {
    this._express = express();

    // Kubernetes probes (and Docker healthcheck) expect these.
    this._express.get('/health', (_req, res) => res.status(200).send('ok'));
    this._express.get('/ready', (_req, res) => res.status(200).send('ok'));

    // Serve static assets (JS/CSS/images). Do NOT serve index here; SSR should handle HTML.
    this._express.use(
      express.static(this._cfg.staticDir, {
        maxAge: '1y',
        index: false,
      }),
    );

    // Resolve index.html to an absolute filesystem path for SSR engine.
    this._cfg.index = `${this._cfg.staticDir}/${this._cfg.index}`;
  }

  start(args: { port: number; }) {
    this._express.listen(args.port, () => {
      console.log(`Node Express server listening on http://localhost:${args.port}`);
    });
  }
  
  onRenderRequest(render: (req: any, cfg: any) => Promise<string>) {
    this._express.get('**', async (req, res, next) => {
      // this should be handled bo cancelation token
      // req.on('close', () => null)

      try {
        const result = await render(req, this._cfg)
        res.send(result)
      } catch (err) {
        next(err)
      }
    });
  }

}






// this._cfg.index = existsSync(join(this._cfg.staticDir, 'index.original.html'))
//       ? join(this._cfg.staticDir, 'index.original.html')
//       : join(this._cfg.staticDir, 'index.html');


/**
 * Example Express Rest API endpoints can be defined here.
 * Uncomment and define endpoints as necessary.
 *
 * Example:
 * ```ts
 * app.get('/api/**', (req, res) => {
 *   // Handle API request
 * });
 * ```
 */

