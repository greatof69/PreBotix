import { ArrowRight, Bot, Cpu, Wrench, ChevronRight, ChevronLeft } from "lucide-react";
import { heroSlides } from "../data/heroSlides";

export default function HeroSlider({ lang, t, activeSlide, prevSlide, slideDir, goToSlide, slideText }) {
  return (
<section className="hero" id="home"><div className="hero-grid"></div><div className="hero-copy-stage">{[prevSlide, activeSlide].filter(i => i !== null).map(i => <div key={i} className={`hero-content ${i === activeSlide ? "is-active" + (slideDir === 1 ? " enter-fwd" : slideDir === -1 ? " enter-back" : "") : "is-prev " + (slideDir === 1 ? "exit-fwd" : "exit-back")}`} aria-hidden={i !== activeSlide}><div className="eyebrow"><span className="live-dot"></span>{slideText(i).badge}</div><h1>{slideText(i).headlineA}<br /><span>{slideText(i).headlineB}</span></h1><p className="hero-copy">{slideText(i).subtitle}</p><div className="hero-actions"><a className="button button-primary" href="#projects">{t.explore}<ArrowRight size={17} /></a><a className="button button-outline" href="#custom"><Wrench size={17} />{t.custom}</a></div><div className="hero-proof"><div className="avatar-stack"><span>P</span><span>B</span><span>+</span></div><p><strong>{t.builtFor}</strong><br /><small>{t.builtForSub}</small></p></div></div>)}</div>
          <div className="hero-visual">
            <div className="visual-glow"></div>
            <div className="orbit orbit-one"></div>
            <div className="orbit orbit-two"></div>

            <div className="hero-image-stage">
              {heroSlides.map((slide, index) => (
                <img
                  key={slide.image}
                  src={slideText(index).image || slide.image}
                  alt={lang === "bn" ? `PreBotix রোবোটিক্স ও ইলেকট্রনিক্স ব্যানার ${index + 1}` : slide.alt}
                  className={
                    activeSlide === index
                      ? `hero-slide-image is-active${slideDir === 1 ? " enter-fwd" : slideDir === -1 ? " enter-back" : ""}`
                      : prevSlide === index
                        ? `hero-slide-image is-prev ${slideDir === 1 ? "exit-fwd" : "exit-back"}`
                        : "hero-slide-image"
                  }
                  fetchPriority={activeSlide === index ? "high" : "auto"}
                  loading={Math.abs(activeSlide - index) <= 1 ? "eager" : "lazy"}
                />
              ))}
            </div>

            <div className="floating-card card-top">
              <span className="mini-icon"><Cpu size={17} /></span>
              <span>
                <strong>{t.precision}</strong><small>{t.precisionSub}</small>
              </span>
              <span className="status-dot"></span>
            </div>

            <div className="floating-card card-bottom">
              <span className="mini-icon cyan"><Bot size={19} /></span>
              <span>
                <strong>{t.makeReal}</strong><small>{t.makeRealSub}</small>
              </span>
            </div>

            <div className="visual-label">
              <span>PB / LAB-01</span>
              <span>{slideText(activeSlide).label}</span>
            </div>
          </div>
          <div className="hero-side-label">{slideText(activeSlide).label}</div><div className="hero-slider-controls" aria-label={t.bannerControls}><button className="hero-slider-arrow" type="button" aria-label={t.prevBanner} onClick={() => goToSlide(current => (current - 1 + heroSlides.length) % heroSlides.length, -1)}><ChevronLeft size={16} /></button><div className="hero-slider-dots">{heroSlides.map((slide, index) => <button key={slide.badge} type="button" className={activeSlide === index ? "hero-slider-dot active" : "hero-slider-dot"} aria-label={`${t.showBanner} ${index + 1}`} aria-current={activeSlide === index ? "true" : undefined} onClick={() => goToSlide(index)} />)}</div><button className="hero-slider-arrow" type="button" aria-label={t.nextBanner} onClick={() => goToSlide(current => (current + 1) % heroSlides.length, 1)}><ChevronRight size={16} /></button></div></section>
  );
}

