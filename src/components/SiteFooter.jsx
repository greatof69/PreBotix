import { CircuitBoard } from "lucide-react";

export default function SiteFooter({ t }) {
  return (
<footer className="site-footer"><a className="brand" href="#home"><span className="brand-icon"><CircuitBoard size={22} /></span><span>PRE<span className="brand-accent">BOTIX</span><small>{t.brandTag}</small></span></a><p>{t.footer}</p><span>© {new Date().getFullYear()} PreBotix. <span className="footer-muted">{t.footerTags}</span></span></footer>
  );
}
