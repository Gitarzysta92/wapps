const { test } = require('node:test');
const { execFileSync } = require('node:child_process');
const path = require('node:path');

test('alpha configuration preserves existing secrets and separates Authentication from Account', () => {
  execFileSync(
    'python3',
    [
      '-B',
      '-c',
      `
import importlib.util,json,tempfile,pathlib,os
root=pathlib.Path.cwd()
spec=importlib.util.spec_from_file_location('alpha_config', root/'deploy/alpha/prepare-config.py')
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
bundle={'projectId':'test-project','apiKey':'test-key','serviceAccount':{'project_id':'test-project','private_key':'test-only'}}
with tempfile.TemporaryDirectory() as temporary:
 directory=pathlib.Path(temporary)
 module.prepare(directory,bundle,'https://alpha.wapps.ai')
 first=json.loads((directory/'generated.json').read_text())
 del first['authenticationMysql']
 del first['authenticationService']
 (directory/'generated.json').write_text(json.dumps(first))
 module.prepare(directory,bundle,'https://alpha.wapps.ai')
 current=json.loads((directory/'generated.json').read_text())
 assert all(current[key]==value for key,value in first.items())
 before={p.name:p.read_bytes() for p in directory.iterdir()}
 module.prepare(directory,bundle,'https://alpha.wapps.ai')
 assert before=={p.name:p.read_bytes() for p in directory.iterdir()}
 env=lambda name:dict(line.split('=',1) for line in (directory/(name+'.env')).read_text().splitlines())
 account,auth,bff,migration=map(env,['account-management','firebase-auth-validator','catalog-bff','authentication-migrate'])
 assert account['MYSQL_DATABASE']=='identity' and auth['MYSQL_DATABASE']=='authentication'
 assert account['MYSQL_USERNAME']!=auth['MYSQL_USERNAME'] and account['MYSQL_PASSWORD']!=auth['MYSQL_PASSWORD']
 assert auth['AUTH_PROVIDER']=='firebase' and auth['NODE_ENV']=='production'
 assert account['AUTH_ISSUER']==auth['AUTH_ISSUER']=='firebase:test-project'
 assert account['AUTH_SERVICE_SECRET']==auth['AUTH_SERVICE_SECRET']
 assert account['AUTH_SERVICE_SECRET']!=account['INGRESS_AUTH_SECRET']
 assert account['AUTHENTICATION_URL']=='http://firebase-auth-validator:8080'
 assert bff['ACCOUNT_MANAGEMENT_URL']=='http://account-management:1340'
 assert not any(key.startswith('FIREBASE_') or key=='GOOGLE_APPLICATION_CREDENTIALS' for key in account)
 assert not any(key.startswith('QUEUE_') or key=='INGRESS_AUTH_SECRET' for key in auth)
 assert 'AUTH_SERVICE_SECRET' not in bff and 'MYSQL_PASSWORD' not in bff
 assert migration['MYSQL_DATABASE']==auth['MYSQL_DATABASE']
 assert all((p.stat().st_mode & 0o077)==0 for p in directory.iterdir())
`,
    ],
    { cwd: path.resolve(__dirname, '../..'), stdio: 'pipe' }
  );
});
