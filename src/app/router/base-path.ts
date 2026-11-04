export function resolveRouterBasePath(baseUrl: string): '/' | '/services' {
  return baseUrl === '/services/' ? '/services' : '/'
}
