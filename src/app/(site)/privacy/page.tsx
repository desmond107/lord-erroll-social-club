import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { CLUB } from "@/lib/site";

export const metadata: Metadata = { title: "Privacy Policy" };

// CONFIRM: draft for the client's legal review and their ODPC registration details.
export default function PrivacyPage() {
  return (
    <LegalPage eyebrow="Legal" title="Privacy Policy" updated="17 November 2026" intro="How we collect, use and protect your personal data, in line with the Kenya Data Protection Act, 2019.">
      <h2>Who we are</h2>
      <p>{CLUB.name}, {CLUB.address}, is the data controller for personal data processed through this website. Contact: {CLUB.email} · {CLUB.phone}.</p>
      <h2>What we collect, and why</h2>
      <ul>
        <li><strong>Application details</strong> (name, phone, email, ID or passport number, date of birth, residence, occupation): to assess your application, verify your identity and age, and administer your membership.</li>
        <li><strong>Optional photograph</strong>: for your membership card, only if you choose to provide one.</li>
        <li><strong>Payment records</strong>: amounts, dates and payment references. We never see or store card numbers; card payments are processed by our payment provider.</li>
        <li><strong>Security logs</strong>: limited technical data to protect accounts and prevent misuse of the membership check.</li>
      </ul>
      <p>Our lawful bases are your consent, the performance of your membership contract, and our legal obligations.</p>
      <h2>Children&apos;s data</h2>
      <p>Junior membership involves the personal data of children. We process it only with the verifiable consent of a parent or legal guardian, and collect only what is needed: the child&apos;s name, date of birth, a document proving date of birth, and the guardian&apos;s details. A photograph is optional and requires the guardian&apos;s explicit consent.</p>
      <ul>
        <li>Date-of-birth documents are stored encrypted and can be viewed only by our most senior administrator. Every viewing is logged.</li>
        <li>The public membership check shows only whether a Junior membership is valid, with no name, photo or age.</li>
        <li>We never use a child&apos;s data for advertising or profiling, never share it with third parties for marketing, and never send marketing messages to a child. All communication goes to the guardian.</li>
      </ul>
      <h2>How we protect your data</h2>
      <p>ID numbers, phone numbers and email addresses are encrypted at rest. Uploaded documents are encrypted and kept in private storage. Access by our staff is limited by role and every administrative action is logged. All traffic is encrypted in transit.</p>
      <h2>Sharing</h2>
      <p>We share data only with service providers who help us run the Club (payment processing, SMS and email delivery, secure hosting), under contracts that require them to protect it, or where the law requires.</p>
      <h2>How long we keep it</h2>
      <p>For as long as you are a member, and for up to seven years afterwards for financial records. Applications that are declined are deleted after twelve months. Membership numbers are retained so that a number is never reissued.</p>
      <h2>Your rights</h2>
      <p>You may ask to access, correct or delete your personal data, object to processing, or withdraw consent, at any time. Signed-in members can do this from <strong>My Account → Privacy</strong>; guardians can make the same requests on behalf of a Junior member. You may also complain to the Office of the Data Protection Commissioner.</p>
      <h2>Marketing</h2>
      <p>We send marketing only to adult members who opt in, and you can opt out at any time.</p>
    </LegalPage>
  );
}
