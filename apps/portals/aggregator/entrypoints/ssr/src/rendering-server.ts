import express, { Application } from 'express';

export interface IRenderingServerConfiguration {
  publicDir: string;
  index: string;
}

// What are benefits of this compared to the AngularUniversal.
export class RenderingServer {
  private _express: Application;

  constructor(
    private readonly _cfg: IRenderingServerConfiguration
  ) {
    this._express = express();
    this._express.get(
      '**',
      express.static(this._cfg.publicDir, {
        maxAge: '1y',
        index: this._cfg.index
      }),
    );

    this._cfg.index = `${this._cfg.publicDir}/${this._cfg.index}`
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

