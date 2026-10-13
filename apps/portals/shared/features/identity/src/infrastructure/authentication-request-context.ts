import { HttpContextToken } from '@angular/common/http';

/** Destructive account requests must keep their original session and report uncertain responses. */
export const SKIP_AUTHENTICATION_RECOVERY = new HttpContextToken(() => false);
