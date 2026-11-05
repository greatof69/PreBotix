import React from "react";
import { CircuitBoard, MessageCircle, ArrowRight, Cpu, Lightbulb, ShieldCheck, Truck } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function CustomProjectPage({ lang = "en" }) {
  const navigate = useNavigate();
  const bn = lang === "bn";

  const benefits = [
    {
      icon: Lightbulb,
      title: bn ? "কাস্টম ডিজাইন" : "Custom Design",
      description: bn ? "আপনার চাহিদা অনুযায়ী" : "Tailored to your needs",
    },
    {
      icon: Cpu,
      title: bn ? "বিশেষজ্ঞ সহায়তা" : "Expert Support",
      description: bn ? "প্রজেক্ট পরিকল্পনায় সহায়তা" : "Guidance from experienced engineers",
    },
    {
      icon: ShieldCheck,
      title: bn ? "মানসম্মত কম্পোনেন্ট" : "Quality Components",
      description: bn ? "নির্ভরযোগ্য যন্ত্রাংশ" : "Reliable and tested parts",
    },
    {
      icon: Truck,
      title: bn ? "সময়মতো ডেলিভারি" : "On-Time Delivery",
      description: bn ? "সময়কে গুরুত্ব দিয়ে" : "Because your time matters",
    },
  ];

  return (
    <section className="pb-custom-project">
      <div className="pb-custom-hero">
        <div className="pb-custom-hero-copy">
          <span className="pb-custom-eyebrow">
            {bn ? "কাস্টম প্রজেক্ট" : "CUSTOM PROJECTS"}
          </span>

          <h1>
            {bn ? (
              <>আপনার আইডিয়ায় তৈরি হোক <span>রোবোটিক্স প্রজেক্ট</span></>
            ) : (
              <>Build Your Custom <span>Robotics Project</span></>
            )}
          </h1>

          <p>
            {bn
              ? "আপনার প্রজেক্টের আইডিয়া, প্রয়োজনীয় ফিচার ও বাজেট জানান। আপনার প্রয়োজন অনুযায়ী রোবোটিক্স সমাধান তৈরিতে আমরা সাহায্য করব।"
              : "Share your project idea, required features, and budget. We’ll help you plan and build a robotics solution tailored to your needs."}
          </p>

          <button
            type="button"
            className="pb-custom-cta"
            onClick={() => navigate("/contact")}
          >
            <MessageCircle size={18} />
            {bn ? "প্রজেক্ট নিয়ে আলোচনা করুন" : "Discuss Your Project"}
            <ArrowRight size={18} />
          </button>
        </div>

        <div className="pb-custom-hero-art" aria-hidden="true">
          <CircuitBoard size={150} strokeWidth={0.8} />
          <Cpu size={70} strokeWidth={1.1} />
        </div>
      </div>

      <section className="pb-custom-benefits">
        <div className="pb-custom-section-heading">
          <h2>{bn ? "আমাদের কেন বেছে নেবেন?" : "Why Choose Us?"}</h2>
          <p>
            {bn
              ? "আপনার ধারণা থেকে বাস্তব প্রোটোটাইপ তৈরিতে পাশে আছি।"
              : "From concept to completion, we help turn your ideas into working prototypes."}
          </p>
        </div>

        <div className="pb-custom-benefit-grid">
          {benefits.map(({ icon: Icon, title, description }) => (
            <article className="pb-custom-benefit" key={title}>
              <div className="pb-custom-benefit-icon">
                <Icon size={27} />
              </div>
              <h3>{title}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="pb-custom-steps">
        <div className="pb-custom-section-heading">
          <h2>{bn ? "যেভাবে শুরু করবেন" : "How It Works"}</h2>
          <p>
            {bn
              ? "আপনার আইডিয়া থেকে প্রজেক্ট তৈরির সহজ তিনটি ধাপ।"
              : "Three simple steps to get your robotics project started."}
          </p>
        </div>

        <div className="pb-custom-step-grid">
          <article className="pb-custom-step">
            <span>01</span>
            <h3>{bn ? "আইডিয়া শেয়ার করুন" : "Share Your Idea"}</h3>
            <p>
              {bn
                ? "প্রজেক্টের উদ্দেশ্য, ফিচার ও বাজেট জানান।"
                : "Tell us the purpose, features, and budget for your project."}
            </p>
          </article>

          <article className="pb-custom-step">
            <span>02</span>
            <h3>{bn ? "পরিকল্পনা ও আলোচনা" : "Plan Together"}</h3>
            <p>
              {bn
                ? "প্রয়োজনীয় কম্পোনেন্ট ও সম্ভাব্য সমাধান নিয়ে আলোচনা করুন।"
                : "Discuss suitable components and possible solutions."}
            </p>
          </article>

          <article className="pb-custom-step">
            <span>03</span>
            <h3>{bn ? "প্রজেক্ট তৈরি" : "Build Your Project"}</h3>
            <p>
              {bn
                ? "পরিকল্পনা অনুযায়ী প্রজেক্ট তৈরির পরবর্তী ধাপ শুরু করুন।"
                : "Move forward with building your project based on the agreed plan."}
            </p>
          </article>
        </div>
      </section>

      <section className="pb-custom-bottom-cta">
        <div>
          <h2>{bn ? "আপনার কি একটি ইউনিক আইডিয়া আছে?" : "Have a unique idea?"}</h2>
          <p>
            {bn
              ? "চলুন, একসাথে আপনার আইডিয়াকে বাস্তবে রূপ দিই।"
              : "Let’s bring your idea to life together."}
          </p>
        </div>

        <button
          type="button"
          className="pb-custom-cta"
          onClick={() => navigate("/contact")}
        >
          {bn ? "যোগাযোগ করুন" : "Contact Us"}
          <ArrowRight size={18} />
        </button>
      </section>
    </section>
  );
}