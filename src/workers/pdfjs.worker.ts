/**
 * pdf.js's own worker, which parses PDFs off the main thread. Importing it
 * inside a worker is enough: it starts listening on its own. Going through
 * this file lets the bundler hash and serve it like any other chunk, so the
 * service worker caches it for offline use.
 *
 * The legacy build, because the modern one relies on Promise.try, which
 * Safari before 18.2 and older Android browsers do not have.
 */
import "pdfjs-dist/legacy/build/pdf.worker.mjs";
