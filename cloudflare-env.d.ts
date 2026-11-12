declare namespace Cloudflare {
  interface Env {
    ASSETS?: Fetcher;
    DB?: D1Database;
    BUCKET?: R2Bucket;
    BUFFER_API_KEY?: string;
    BUFFER_ORGANIZATION_ID?: string;
    EMAIL_ALERTS_ENABLED?: string;
    WEB3FORMS_ACCESS_KEY?: string;
  }
}
