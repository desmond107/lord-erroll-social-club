import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { CLUB } from "@/lib/site";

export const metadata: Metadata = { title: "Terms and Conditions" };

// CONFIRM: draft terms for the client's legal review before launch.
export default function TermsPage() {
  return (
    <LegalPage eyebrow="Legal" title="Terms and Conditions" updated="17 November 2026" intro="The rules of membership of The Lord Erroll Social Club.">
      <h2>1. Membership</h2>
      <p>Membership of {CLUB.name} (&ldquo;the Club&rdquo;) is offered at the discretion of the membership committee, which may decline any application without giving reasons. Membership is personal and non-transferable.</p>
      <p>Adult membership is open to persons aged 18 or over. Junior membership is open to persons within the Junior age range set by the Club and must be applied for, held and managed by a parent or legal guardian.</p>
      <h2>2. Fees, activation and renewal</h2>
      <ul>
        <li>A membership becomes active only when the annual subscription has been received in full.</li>
        <li>Membership runs for twelve months from activation. Renewal before expiry extends the membership by a further twelve months from the existing expiry date.</li>
        <li>After expiry there is a grace period set by the Club. After that, the membership is marked Expired and the card deactivated until renewal. The membership number is kept on renewal.</li>
        <li>Upgrades may be made at any time on payment of the pro-rated difference. Downgrades take effect at renewal.</li>
        <li>Fees are not refundable, save where required by law or at the Club&apos;s discretion.</li>
      </ul>
      <h2>3. Cards and verification</h2>
      <p>Members must present their membership card on request. Cards remain the property of the Club. Lending a card, or allowing another person to use it, may lead to suspension.</p>
      <h2>4. Conduct</h2>
      <p>Members are responsible for their own conduct and that of their guests, and must observe the Club&apos;s dress code and house rules. The Club may suspend or terminate a membership for conduct it considers detrimental to the Club, its staff or its members.</p>
      <h2>5. Junior members</h2>
      <ul>
        <li>Junior members may not be served alcohol or tobacco and are not admitted to adult-only events, including Ladies Night, Cigar Night and After Dinner at the Highlander Bar.</li>
        <li>Junior members must be accompanied by their parent or guardian, or another adult approved by the Club, while on the premises.</li>
        <li>The guardian accepts these terms on the child&apos;s behalf and is responsible for the Junior member&apos;s conduct.</li>
        <li>On reaching 18, the member must accept these terms personally and choose an adult package; otherwise the membership lapses after the grace period set by the Club.</li>
      </ul>
      <h2>6. Family / Joint membership</h2>
      <p>The primary member is responsible for the family membership, its payment and the conduct of linked members. Linked members&apos; privileges end with the primary membership.</p>
      <h2>7. Changes</h2>
      <p>The Club may amend these terms, its packages and its benefits. Material changes will be notified to members by email.</p>
      <h2>8. Contact</h2>
      <p>{CLUB.name}, {CLUB.address} · {CLUB.phone} · {CLUB.email}</p>
    </LegalPage>
  );
}
