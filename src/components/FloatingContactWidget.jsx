import { useRef, useState } from "react";
import { Bot } from "lucide-react";

const CONTACTS = {
    whatsapp: "https://wa.me/8801XXXXXXXXX",
    facebook: "https://www.facebook.com/PreBotix",
    instagram: "https://www.instagram.com/rahulhalder_01",
};

const SOCIALS = [
    {
        name: "Admin whatsApp",
        className: "whatsapp",
        url: CONTACTS.whatsapp,
        icon: (
            <svg viewBox="0 0 24 24" width="23" height="23" fill="currentColor" aria-hidden="true">
                <path d="M20.52 3.48A11.78 11.78 0 0 0 12.15 0C5.63 0 .32 5.3.32 11.83c0 2.08.55 4.11 1.59 5.91L.22 24l6.42-1.68a11.82 11.82 0 0 0 5.5 1.36h.01c6.52 0 11.83-5.31 11.83-11.83 0-3.16-1.23-6.13-3.46-8.37ZM12.15 21.7a9.8 9.8 0 0 1-4.99-1.37l-.36-.21-3.81 1 1.02-3.71-.23-.38a9.82 9.82 0 1 1 8.37 4.67Zm5.39-7.36c-.29-.15-1.71-.84-1.98-.94-.26-.1-.46-.15-.66.15-.19.29-.75.94-.92 1.13-.17.2-.34.22-.63.08-.29-.15-1.22-.45-2.33-1.44-.86-.77-1.44-1.72-1.61-2.01-.17-.29-.02-.45.13-.6.13-.13.29-.34.44-.51.14-.17.19-.29.29-.48.1-.2.05-.37-.02-.52-.08-.15-.66-1.59-.9-2.18-.24-.57-.48-.49-.66-.5h-.56c-.2 0-.51.08-.78.37-.27.29-1.02.99-1.02 2.43s1.05 2.82 1.2 3.01c.15.2 2.06 3.15 4.99 4.42.7.3 1.25.48 1.68.61.7.22 1.33.19 1.83.12.56-.08 1.71-.7 1.95-1.39.24-.68.24-1.27.17-1.39-.08-.12-.27-.19-.56-.34Z" />
            </svg>
        ),
    },
    {
        name: "Admin facebook",
        className: "facebook",
        url: CONTACTS.facebook,
        icon: (
            <svg viewBox="0 0 24 24" width="23" height="23" fill="currentColor" aria-hidden="true">
                <path d="M13.5 21v-8.2h2.76l.41-3.2H13.5V7.56c0-.93.26-1.56 1.6-1.56h1.71V3.14C16.51 3.05 15.5 3 14.31 3c-2.5 0-4.21 1.53-4.21 4.34V9.6H7.27v3.2h2.83V21h3.4Z" />
            </svg>
        ),
    },
    {
        name: "Admin instagram",
        className: "instagram",
        url: CONTACTS.instagram,
        icon: (
            <svg viewBox="0 0 24 24" width="23" height="23" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <rect x="3" y="3" width="18" height="18" rx="5" />
                <circle cx="12" cy="12" r="4" />
                <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
            </svg>
        ),
    },
];

export default function FloatingContactWidget({ onOpenAI }) {
    const [isHovered, setIsHovered] = useState(false);
    const closeTimer = useRef(null);

    const menuVisible = isHovered;

    const showMenu = () => {
        clearTimeout(closeTimer.current);
        setIsHovered(true);
    };

    // Small delay so the menu stays open while moving from robot to icons
    const hideMenu = () => {
        clearTimeout(closeTimer.current);
        closeTimer.current = setTimeout(() => setIsHovered(false), 180);
    };

    const handleBlur = (event) => {
        const root = event.currentTarget.closest(".pb-float-contact");
        if (!root?.contains(event.relatedTarget)) {
            hideMenu();
        }
    };

    // Click on robot: open the AI chat
    const handleAI = () => {
        if (typeof onOpenAI === "function") {
            onOpenAI();
            return;
        }

        window.dispatchEvent(
            new CustomEvent("prebotix:open-ai")
        );
    };

    return (
        <div
            className={`pb-float-contact ${menuVisible ? "menu-open" : ""}`}
            onMouseEnter={showMenu}
            onMouseLeave={hideMenu}
        >
            {/* Robot button: hover opens social icons, click opens AI */}
            <button
                type="button"
                className="pb-float-contact__button pb-float-contact__ai"
                aria-label="Click to ask PreBotix"
                aria-expanded={menuVisible}
                onMouseEnter={showMenu}
                onFocus={showMenu}
                onBlur={handleBlur}
                onClick={handleAI}
            >
                <Bot size={30} />
                <span className="pb-float-contact__tooltip pb-float-contact__tooltip--ai">
                    Click to ask PreBotix
                </span>
            </button>

            {/* Social icons (must stay right after the button) */}
            <div className="pb-float-contact__social-row" aria-hidden={!menuVisible}>
                {SOCIALS.map((item) => (
                    <a
                        key={item.name}
                        className={`pb-float-contact__button pb-float-contact__social pb-float-contact__social--${item.className}`}
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Contact PreBotix on ${item.name}`}
                        tabIndex={menuVisible ? 0 : -1}
                        onMouseEnter={showMenu}
                        onFocus={showMenu}
                        onBlur={handleBlur}
                    >
                        {item.icon}
                        <span className="pb-float-contact__tooltip">{item.name}</span>
                    </a>
                ))}
            </div>
        </div>
    );
}