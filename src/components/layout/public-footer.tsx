import Link from "next/link";
import { Logo } from "./logo";

export function PublicFooter({ supportEmail, address }: { supportEmail: string; address: string }) {
  return (
    <footer className="mt-24 bg-navy-950 text-ivory/80">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-4">
        <div className="md:col-span-2">
          <Logo light />
          <p className="mt-4 max-w-sm text-sm leading-relaxed">
            Expanding equitable access to transformative education for young Africans from underserved communities — starting with Nigeria.
          </p>
          <p className="mt-4 text-xs text-ivory/60">SOAR Hub helps you prepare. It never guarantees admission, selection or an award — universities make all final decisions.</p>
        </div>
        <nav aria-label="Platform">
          <h2 className="text-sm font-semibold text-ivory">Platform</h2>
          <ul className="mt-3 space-y-2 text-sm">
            <li><Link className="hover:text-gold-400" href="/scholarships">Scholarships</Link></li>
            <li><Link className="hover:text-gold-400" href="/resources">Learning resources</Link></li>
            <li><Link className="hover:text-gold-400" href="/register">Create an account</Link></li>
            <li><Link className="hover:text-gold-400" href="/guide">How to apply</Link></li>
            <li><Link className="hover:text-gold-400" href="/faq">FAQs</Link></li>
          </ul>
        </nav>
        <div>
          <h2 className="text-sm font-semibold text-ivory">Contact</h2>
          <ul className="mt-3 space-y-2 text-sm">
            <li><a className="hover:text-gold-400" href={`mailto:${supportEmail}`}>{supportEmail}</a></li>
            <li>{address}</li>
            <li><Link className="hover:text-gold-400" href="/contact">Contact form</Link></li>
            <li><Link className="hover:text-gold-400" href="/privacy">Privacy policy</Link></li>
            <li><Link className="hover:text-gold-400" href="/terms">Terms of service</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10 py-5 text-center text-xs text-ivory/50">© {new Date().getFullYear()} SOAR Hub. Built for young Nigerians with big ambitions.</div>
    </footer>
  );
}
