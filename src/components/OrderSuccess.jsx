import { ArrowRight, CheckCircle2 } from "lucide-react";
import { formatPrice } from "../utils/formatPrice";

export default function OrderSuccess({ order, lang, t, onClose }) {
  const number = order.number;
  return <div className="modal-backdrop"><section className="success-panel" role="dialog" aria-modal="true" aria-label={t.orderPlaced}><span className="success-icon"><CheckCircle2 size={36} /></span><span className="section-kicker">PREBOTIX / {lang === "bn" ? "অর্ডার নিশ্চিত" : "ORDER CONFIRMED"}</span><h2>{t.orderPlaced}</h2><p>{t.orderMessage}</p><div className="demo-order-number"><span>{t.orderNumber}</span><strong>{number}</strong></div><div className="success-order-lines">{order.items.map(item => <div key={item.id}><span>{item.quantity}× {lang === "bn" ? item.bn : item.title}</span><strong>{formatPrice(item.price * item.quantity, lang)}</strong></div>)}<div className="summary-total"><span>{t.total}</span><strong>{formatPrice(order.subtotal, lang)}</strong></div></div><button className="button button-primary checkout-button" onClick={onClose}>{t.newOrder}<ArrowRight size={16} /></button><small>{t.thankYou}</small></section></div>;
}

