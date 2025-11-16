import { Link } from 'react-router-dom'

export default function TermsOfServicePage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="bg-slate-900 rounded-lg border border-slate-700 p-8 md:p-12">
        <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">Terms of Service</h1>
        <p className="text-slate-400 mb-2">Last updated: November 6, 2025</p>
        <p className="text-slate-400 mb-8">Website: <a href="https://chessdata.app" target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:text-sky-300 underline">https://chessdata.app</a></p>

        <div className="prose prose-invert max-w-none space-y-6 text-slate-300">
          <section>
            <h2 className="text-2xl font-semibold text-white mt-8 mb-4">1. Acceptance of Terms</h2>
            <p>
              By accessing or using chessdata.app ("the Service"), you agree to be bound by these Terms of Service ("Terms").
            </p>
            <p className="mt-4">
              If you do not agree to these Terms, you may not use or access the Service.
            </p>
            <p className="mt-4">
              These Terms govern your use of the Service operated by chessdata.app ("we," "us," or "our") and form a binding agreement between you and us.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mt-8 mb-4">2. Description of Service</h2>
            <p>
              chessdata.app is a chess analytics platform that helps players improve their performance through advanced analysis and insights.
            </p>
            <p className="mt-4">
              Our Service provides features such as:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Game import from Lichess and Chess.com</li>
              <li>Chess game analysis using the Stockfish engine</li>
              <li>Performance tracking and personalized statistics</li>
              <li>Opening analysis and historical trends</li>
              <li>Personality and style scoring</li>
            </ul>
            <p className="mt-4">
              We may add, modify, or remove features over time to improve the user experience.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mt-8 mb-4">3. Account Registration</h2>
            <p>To access certain features of the Service, you must:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Create an account using a valid email address</li>
              <li>Provide accurate and complete information</li>
              <li>Maintain the security of your account credentials</li>
              <li>Notify us immediately of unauthorized use of your account</li>
            </ul>
            <p className="mt-4">
              You are responsible for all activities that occur under your account.
            </p>
            <p className="mt-4">
              You must be at least 13 years old (or the minimum legal age in your jurisdiction) to use the Service.
            </p>
            <p className="mt-4">
              We may suspend or terminate accounts that violate these Terms or engage in fraudulent, abusive, or illegal activity.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mt-8 mb-4">4. Acceptable Use</h2>
            <p>You agree not to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Use the Service for any unlawful or unauthorized purpose</li>
              <li>Attempt to gain unauthorized access to any part of the Service or its systems</li>
              <li>Use automated tools (bots, scrapers, etc.) to extract data or bypass limits</li>
              <li>Interfere with or disrupt the Service, servers, or networks</li>
              <li>Reverse engineer, decompile, or disassemble any part of the Service</li>
              <li>Transmit malware, viruses, or harmful code</li>
              <li>Create multiple accounts to bypass usage limits</li>
              <li>Impersonate others or provide false information</li>
              <li>Use the Service in a way that could overload or harm our infrastructure</li>
            </ul>
            <p className="mt-4">
              Violation of these terms may result in suspension or termination of your account.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mt-8 mb-4">5. Usage Limits</h2>
            <p>
              Our Service offers different tiers with specific usage limits:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Free Registered Accounts:</strong> Up to 100 game imports per day and 5 analyses per day</li>
              <li><strong>Anonymous/Guest Users:</strong> Up to 50 game imports per day and 2 analyses per day</li>
              <li><strong>Pro Tier:</strong> Unlimited imports and analyses</li>
            </ul>
            <p className="mt-4">
              We reserve the right to adjust usage limits at any time.
            </p>
            <p className="mt-4">
              Circumventing limits by using multiple accounts or technical methods is prohibited and may lead to account suspension or termination.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mt-8 mb-4">6. Subscriptions and Payments</h2>
            <p>
              Pro subscriptions are billed monthly or annually.
            </p>
            <p className="mt-4">
              By subscribing, you agree to:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Pay the applicable fees at the time of purchase</li>
              <li>Accept automatic renewal unless cancelled</li>
              <li>Receive advance notice of any price changes</li>
            </ul>
            <p className="mt-4">
              <strong>Cancellation:</strong>
            </p>
            <p className="mt-2">
              You may cancel your subscription at any time via your account settings. Cancellation becomes effective at the end of your current billing period.
            </p>
            <p className="mt-2">
              No refunds are issued for partial billing periods.
            </p>
            <p className="mt-4">
              <strong>Refunds:</strong>
            </p>
            <p className="mt-2">
              Refunds may be issued on a case-by-case basis within 14 days of the charge.
            </p>
            <p className="mt-2">
              Contact <a href="mailto:support@chessdata.app" className="text-sky-400 hover:text-sky-300 underline">support@chessdata.app</a> if you believe you are entitled to a refund.
            </p>
            <p className="mt-4">
              <strong>Payment Processing:</strong>
            </p>
            <p className="mt-2">
              Payments are securely handled by Stripe.
            </p>
            <p className="mt-2">
              Your payment details are processed in accordance with <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:text-sky-300 underline">Stripe's Privacy Policy</a>.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mt-8 mb-4">7. Third-Party Services</h2>
            <p>
              Our Service integrates with third-party platforms, including:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Lichess and Chess.com</strong> — for importing game data via their public APIs</li>
              <li><strong>Stripe</strong> — for secure payment processing</li>
              <li><strong>Supabase</strong> — for authentication and data storage</li>
            </ul>
            <p className="mt-4">
              You are responsible for ensuring you have the right to access and import your games from external platforms.
            </p>
            <p className="mt-4">
              Your use of these services is subject to their respective terms and policies.
            </p>
            <p className="mt-4">
              We are not responsible for the accuracy, availability, or content of third-party services.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mt-8 mb-4">8. Intellectual Property</h2>
            <p>
              All content, features, and functionality of the Service—including the design, code, and interface—are the property of chessdata.app and protected by copyright and trademark laws.
            </p>
            <p className="mt-4">
              You may not:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Copy, modify, or create derivative works of the Service</li>
              <li>Use our trademarks, logos, or branding without permission</li>
              <li>Remove or alter copyright notices or proprietary markings</li>
            </ul>
            <p className="mt-4">
              Your imported games and generated analysis results remain your property.
            </p>
            <p className="mt-4">
              By using the Service, you grant us a limited license to store, process, and display your data solely to operate the Service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mt-8 mb-4">9. Data and Privacy</h2>
            <p>
              Your use of the Service is also governed by our <Link to="/privacy" className="text-sky-400 hover:text-sky-300 underline">Privacy Policy</Link>.
            </p>
            <p className="mt-4">
              By using the Service, you consent to the collection and use of your information as described in that policy.
            </p>
            <p className="mt-4">
              We take your privacy seriously and comply with GDPR and other applicable data protection laws.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mt-8 mb-4">10. Service Availability</h2>
            <p>
              We strive to maintain high uptime and reliability. However, we do not guarantee uninterrupted or error-free access.
            </p>
            <p className="mt-4">
              The Service may be temporarily unavailable due to:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Maintenance or updates</li>
              <li>Technical failures</li>
              <li>Outages of third-party services</li>
              <li>Force majeure events</li>
            </ul>
            <p className="mt-4">
              We reserve the right to modify, suspend, or discontinue the Service (or any part of it) at any time, with or without notice.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mt-8 mb-4">11. Disclaimer of Warranties</h2>
            <p>
              The Service is provided "as is" and "as available", without warranties of any kind, express or implied.
            </p>
            <p className="mt-4">
              We make no guarantees that:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>The Service will be uninterrupted, secure, or error-free</li>
              <li>Defects will be corrected</li>
              <li>The results of analyses will be accurate or reliable</li>
            </ul>
            <p className="mt-4">
              Use of the Service is at your own risk.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mt-8 mb-4">12. Limitation of Liability</h2>
            <p>
              To the fullest extent permitted by law, chessdata.app and its owners, employees, and affiliates shall not be liable for any:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Indirect, incidental, special, consequential, or punitive damages</li>
              <li>Loss of profits, data, goodwill, or use</li>
              <li>Damages arising from or related to your use (or inability to use) the Service</li>
            </ul>
            <p className="mt-4">
              Our total liability for any claim shall not exceed the greater of:
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li>The amount you paid us in the 12 months prior to the claim, or</li>
              <li>$100 USD</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mt-8 mb-4">13. Indemnification</h2>
            <p>
              You agree to indemnify and hold harmless chessdata.app, its owners, employees, and agents from any claims, damages, losses, or expenses (including legal fees) arising from:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Your use of the Service</li>
              <li>Your violation of these Terms</li>
              <li>Your infringement of any third-party rights</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mt-8 mb-4">14. Termination</h2>
            <p>
              We may suspend or terminate your account and access to the Service immediately, without notice, for any reason, including:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Breach of these Terms</li>
              <li>Fraudulent or illegal activity</li>
            </ul>
            <p className="mt-4">
              Upon termination:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Your right to use the Service ends immediately</li>
              <li>Your data may be deleted (subject to our Privacy Policy)</li>
              <li>You remain responsible for any fees incurred before termination</li>
            </ul>
            <p className="mt-4">
              You may terminate your account at any time by contacting <a href="mailto:support@chessdata.app" className="text-sky-400 hover:text-sky-300 underline">support@chessdata.app</a> or through your account settings.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mt-8 mb-4">15. Changes to Terms</h2>
            <p>
              We may modify these Terms at any time.
            </p>
            <p className="mt-4">
              If we make significant changes, we will notify users via:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Email, or</li>
              <li>Notice within the Service</li>
            </ul>
            <p className="mt-4">
              Your continued use after changes take effect constitutes acceptance of the new Terms.
            </p>
            <p className="mt-4">
              If you disagree with the changes, you must stop using the Service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mt-8 mb-4">16. Governing Law</h2>
            <p>
              These Terms shall be governed by and construed in accordance with the laws of Estonia, without regard to its conflict of law provisions.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mt-8 mb-4">17. Dispute Resolution</h2>
            <p>
              We aim to resolve disputes amicably. Please contact <a href="mailto:support@chessdata.app" className="text-sky-400 hover:text-sky-300 underline">support@chessdata.app</a> to seek resolution first.
            </p>
            <p className="mt-4">
              If unresolved, disputes may be brought before a court of competent jurisdiction in Estonia.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mt-8 mb-4">18. Severability</h2>
            <p>
              If any provision of these Terms is found invalid or unenforceable, it will be limited or removed to the minimum extent necessary, and the remaining provisions will continue in full effect.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mt-8 mb-4">19. Contact Information</h2>
            <p>
              If you have any questions about these Terms, please contact us at:
            </p>
            <p className="mt-4">
              📧 <a href="mailto:support@chessdata.app" className="text-sky-400 hover:text-sky-300 underline">support@chessdata.app</a>
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mt-8 mb-4">20. Entire Agreement</h2>
            <p>
              These Terms constitute the entire agreement between you and chessdata.app regarding your use of the Service and supersede all prior agreements or understandings.
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-slate-700">
          <a
            href="/"
            className="text-sky-400 hover:text-sky-300 underline"
          >
            ← Back to Home
          </a>
        </div>
      </div>
    </div>
  )
}
