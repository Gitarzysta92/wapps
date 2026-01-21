type ConfigValue = {
  value: string;
  optional?: boolean;
};

export type ApplicationShellConfig = Record<string, ConfigValue>;

type ApplicationShellWithInitialize<TInit> = {
  run: (fn: (data: TInit) => Promise<void>) => ApplicationShellWithRun<TInit>;
};

type ApplicationShellWithRun<TInit> = {
  catch: (fn: (err: unknown) => Promise<void>) => ApplicationShellWithCatch<TInit>;
  finally: (fn: (data: TInit) => Promise<void>) => ApplicationShellWithRun<TInit>;
};

type ApplicationShellWithCatch<TInit> = {
  finally: (fn: (data: TInit) => Promise<void>) => ApplicationShellWithCatch<TInit>;
};

export class ApplicationShell {
  private initializeFn: ((params: any) => Promise<any>) | null = null;
  private runFn: ((data: any) => Promise<void>) | null = null;
  private catchFn: ((err: unknown) => Promise<void>) | null = null;
  private finallyFn: ((data: any) => Promise<void>) | null = null;

  constructor(private readonly config: ApplicationShellConfig) {}

  initialize<TInit>(fn: (params: any) => Promise<TInit>): ApplicationShellWithInitialize<TInit> {
    this.initializeFn = fn;
    
    const self = this;
    
    return {
      run(runFn: (data: TInit) => Promise<void>): ApplicationShellWithRun<TInit> {
        self.runFn = runFn as any;
        
        return {
          catch(catchFn: (err: unknown) => Promise<void>): ApplicationShellWithCatch<TInit> {
            self.catchFn = catchFn;
            
            return {
              finally(finallyFn: (data: TInit) => Promise<void>): ApplicationShellWithCatch<TInit> {
                self.finallyFn = finallyFn as any;
                self.execute();
                return {
                  finally: (fn: (data: TInit) => Promise<void>) => {
                    return {} as ApplicationShellWithCatch<TInit>;
                  }
                };
              }
            };
          },
          finally(finallyFn: (data: TInit) => Promise<void>): ApplicationShellWithRun<TInit> {
            self.finallyFn = finallyFn as any;
            self.execute();
            return {
              catch: (fn: (err: unknown) => Promise<void>) => {
                return {} as ApplicationShellWithRun<TInit>;
              },
              finally: (fn: (data: TInit) => Promise<void>) => {
                return {} as ApplicationShellWithRun<TInit>;
              }
            };
          }
        };
      }
    };
  }

  private async execute(): Promise<void> {
    let initializedData: any = null;
    
    try {
      if (!this.initializeFn) {
        throw new Error('initialize() must be called before execute()');
      }

      const params: any = {};
      
      for (const [key, configValue] of Object.entries(this.config)) {
        if (!configValue.optional && !configValue.value) {
          throw new Error(`Required configuration value for '${key}' is missing`);
        }
        if (configValue.value) {
          params[key] = configValue.value;
        }
      }

      initializedData = await this.initializeFn(params);
      
      if (this.runFn) {
        await this.runFn(initializedData);
      }
    } catch (err) {
      if (this.catchFn) {
        await this.catchFn(err);
      }
    } finally {
      if (this.finallyFn && initializedData) {
        await this.finallyFn(initializedData);
      }
    }
  }
}