// Placeholder until the approved logo files are added (brand/logo/README.md).
import logoSvg from '../../brand/logo/logo-placeholder.svg?raw';

export function Logo() {
  return <span className="logo" aria-label="USA Lacrosse" role="img" dangerouslySetInnerHTML={{ __html: logoSvg }} />;
}
