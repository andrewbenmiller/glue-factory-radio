export default function middleware(request) {
  const url = new URL(request.url);
  const host = request.headers.get('host') || url.host;

  // Redirect www to non-www
  if (host === 'www.gluefactoryradio.com') {
    return Response.redirect(`https://gluefactoryradio.com${url.pathname}${url.search}`, 301);
  }

  // Serve splash.html for gluefactoryradio.com root path
  if (host === 'gluefactoryradio.com' && (url.pathname === '/' || url.pathname === '')) {
    return Response.rewrite(new URL('/splash.html', request.url));
  }

  // For all other requests, continue normally
  return;
}

