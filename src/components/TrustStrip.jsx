import { ShieldCheck, Wrench, Truck, Code2 } from "lucide-react";
export default function TrustStrip({ lang }) {
  return <section className="trust-strip"><div><ShieldCheck /><span>{lang === "bn" ? "যাচাইকৃত পণ্য" : "Quality-checked components"}</span></div><div><Wrench /><span>{lang === "bn" ? "কাস্টম প্রজেক্ট তৈরি" : "Custom-built projects"}</span></div><div><Truck /><span>{lang === "bn" ? "বাংলাদেশজুড়ে ডেলিভারি" : "Delivery across Bangladesh"}</span></div><div><Code2 /><span>{lang === "bn" ? "প্রজেক্ট সাপোর্ট" : "Build & technical support"}</span></div></section>;
}
