import logo from "../assets/PreBotix.png";

export default function Footer({ t }) {
  return (
    <footer className="site-footer">
      <a className="brand" href="#home">
        <span className="brand-icon">
          <img className="logo" src={logo} alt="PreBotix" />
        </span>
        <span className="brand-accent">
          <span className="brand-name">PRE</span>
          <span className="brand-accent">BOTIX</span>
          <small>{t.brandTag}</small>
        </span>
      </a>
      <p style={{ fontSize: "12px" }}>{t.footer}</p>
      <span className="footer-copyright">
        &copy; {new Date().getFullYear()} PreBotix. All rights reserved.
      </span>
    </footer>
  );
}
