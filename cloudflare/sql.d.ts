/** Migration files are imported as text so they can run inside workerd, which
 *  has no filesystem. Vite's `?raw` suffix does the inlining. */
declare module "*.sql?raw" {
  const content: string;
  export default content;
}
