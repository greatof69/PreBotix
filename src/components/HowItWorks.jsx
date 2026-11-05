import { CircuitBoard, Wrench, Bot } from "lucide-react";
export default function HowItWorks({ t }) {
 return <section className="section how-section" id="how"><div className="center-heading"><span className="section-kicker">{t.stepsEyebrow}</span><h2>{t.stepsTitle}</h2></div><div className="steps-grid"><div className="step"><span className="step-number">01</span><div className="step-icon"><CircuitBoard /></div><h3>{t.step1}</h3><p>{t.step1d}</p></div><div className="step"><span className="step-number">02</span><div className="step-icon"><Wrench /></div><h3>{t.step2}</h3><p>{t.step2d}</p></div><div className="step"><span className="step-number">03</span><div className="step-icon"><Bot /></div><h3>{t.step3}</h3><p>{t.step3d}</p></div></div></section>;
}
