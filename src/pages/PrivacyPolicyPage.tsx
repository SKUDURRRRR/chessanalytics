export default function PrivacyPolicyPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="bg-slate-900 rounded-lg border border-slate-700 p-8 md:p-12">
        <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">Privacy Policy</h1>
        <p className="text-slate-400 mb-8">Last updated: November 6, 2025</p>

        <div className="prose prose-invert max-w-none space-y-6 text-slate-300">
          <section>
            <h2 className="text-2xl font-semibold text-white mt-8 mb-4">1. Introduction</h2>
            <p>
              At chessdata.app ("we," "us," or "our"), we respect your privacy and are committed to protecting your personal information.
            </p>
            <p className="mt-4">
              This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our chess analytics platform (the "Service").
            </p>
            <p className="mt-4">
              By using chessdata.app, you agree to this Privacy Policy. If you do not agree with our practices, please do not use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mt-8 mb-4">2. Information We Collect</h2>

            <h3 className="text-xl font-semibold text-white mt-6 mb-3">2.1 Information You Provide</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Account Information:</strong> Email address, password (hashed), and username</li>
              <li><strong>Profile Information:</strong> Display name and preferences</li>
              <li><strong>Payment Information:</strong> Processed securely through Stripe — we never store credit card details</li>
              <li><strong>Communications:</strong> Messages you send to our support team</li>
            </ul>

            <h3 className="text-xl font-semibold text-white mt-6 mb-3">2.2 Information Automatically Collected</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Usage Data:</strong> Game imports, analyses performed, features accessed</li>
              <li><strong>Technical Data:</strong> IP address, browser type, device information, timestamps</li>
              <li><strong>Cookies and Tracking:</strong> Session cookies and authentication tokens</li>
            </ul>

            <h3 className="text-xl font-semibold text-white mt-6 mb-3">2.3 Information from Third Parties</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Game Data:</strong> Chess games imported from Lichess and Chess.com via their public APIs</li>
              <li><strong>Authentication:</strong> Account information managed by Supabase (our authentication provider)</li>
              <li><strong>Payments:</strong> Transaction details from Stripe (our payment processor)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mt-8 mb-4">3. How We Use Your Information</h2>
            <p>We use your information to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Provide, maintain, and improve the Service</li>
              <li>Process your game imports and analyses</li>
              <li>Manage your account and subscriptions</li>
              <li>Process payments and prevent fraud</li>
              <li>Send you service-related communications (e.g., account updates, security alerts)</li>
              <li>Respond to your inquiries and support requests</li>
              <li>Monitor and analyze usage patterns to improve performance</li>
              <li>Enforce our Terms of Service</li>
              <li>Comply with legal obligations</li>
            </ul>
            <p className="mt-4">
              <strong>We do not sell your personal information.</strong>
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mt-8 mb-4">4. Data Storage and Security</h2>
            <p>
              We use industry-standard measures to protect your information:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Encryption:</strong> All data in transit is encrypted using HTTPS/TLS</li>
              <li><strong>Password Security:</strong> Passwords are hashed using secure algorithms — never stored in plaintext</li>
              <li><strong>Access Controls:</strong> Restricted and monitored database access</li>
              <li><strong>Regular Updates:</strong> We keep our systems and dependencies current</li>
            </ul>
            <p className="mt-4">
              While we take strong precautions, no internet transmission or electronic storage is 100% secure. We cannot guarantee absolute security, but we act promptly on any identified risks.
            </p>
            <p className="mt-4">
              <strong>Data Location:</strong> Your data is stored on servers operated by Supabase, which may be located outside your country of residence. By using the Service, you consent to such transfers.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mt-8 mb-4">5. Information Sharing and Disclosure</h2>

            <h3 className="text-xl font-semibold text-white mt-6 mb-3">5.1 Service Providers</h3>
            <p>We share data only with trusted third parties that help operate our Service:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Supabase:</strong> Database and authentication</li>
              <li><strong>Stripe:</strong> Payment processing</li>
              <li><strong>Hostinger:</strong> Infrastructure and delivery</li>
            </ul>
            <p className="mt-4">
              All providers are contractually obligated to protect your data and use it only as directed.
            </p>

            <h3 className="text-xl font-semibold text-white mt-6 mb-3">5.2 Legal Requirements</h3>
            <p>We may disclose information when required by law or to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Comply with court orders, subpoenas, or legal processes</li>
              <li>Respond to lawful government requests</li>
              <li>Enforce our Terms of Service</li>
              <li>Protect our rights, property, or safety, or that of users or the public</li>
            </ul>

            <h3 className="text-xl font-semibold text-white mt-6 mb-3">5.3 Business Transfers</h3>
            <p>
              If we are involved in a merger, acquisition, or sale of assets, your information may be transferred to the acquiring entity under the same privacy commitments.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mt-8 mb-4">6. Your Rights and Choices</h2>

            <h3 className="text-xl font-semibold text-white mt-6 mb-3">6.1 Access and Portability</h3>
            <p>
              You may access your account and game data through your dashboard. To request a data export, contact <a href="mailto:support@chessdata.app" className="text-sky-400 hover:text-sky-300 underline">support@chessdata.app</a>.
            </p>

            <h3 className="text-xl font-semibold text-white mt-6 mb-3">6.2 Correction</h3>
            <p>
              You can update account details (email, display name) via your account settings. For other changes, contact us.
            </p>

            <h3 className="text-xl font-semibold text-white mt-6 mb-3">6.3 Deletion</h3>
            <p>
              You may request full account deletion by contacting <a href="mailto:support@chessdata.app" className="text-sky-400 hover:text-sky-300 underline">support@chessdata.app</a>.
            </p>
            <p className="mt-2">
              We will permanently delete your data within 30 days, except where retention is required by law.
            </p>

            <h3 className="text-xl font-semibold text-white mt-6 mb-3">6.4 Opt-Out</h3>
            <p>
              You may opt out of non-essential emails and communications. However, essential service-related messages (e.g., security alerts) cannot be disabled.
            </p>

            <h3 className="text-xl font-semibold text-white mt-6 mb-3">6.5 Data Retention</h3>
            <p>
              We retain information as long as your account is active or necessary to provide the Service. After deletion, limited data may remain for legal or security purposes for a defined period.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mt-8 mb-4">7. Cookies and Tracking Technologies</h2>
            <p>
              We use cookies and similar technologies to:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Authenticate sessions</li>
              <li>Remember user preferences</li>
              <li>Analyze site usage and improve features</li>
            </ul>
            <p className="mt-4">
              You can manage or disable cookies in your browser settings. Note that some features may not function properly if cookies are disabled.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mt-8 mb-4">8. Third-Party Services</h2>
            <p>
              Our Service integrates with third-party platforms. Their use of your data is governed by their own policies.
            </p>
            <p className="mt-4">
              Please review them:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Lichess:</strong> <a href="https://lichess.org/privacy" target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:text-sky-300 underline">Privacy Policy</a></li>
              <li><strong>Chess.com:</strong> <a href="https://www.chess.com/legal/privacy" target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:text-sky-300 underline">Privacy Policy</a></li>
              <li><strong>Stripe:</strong> <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:text-sky-300 underline">Privacy Policy</a></li>
              <li><strong>Supabase:</strong> <a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:text-sky-300 underline">Privacy Policy</a></li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mt-8 mb-4">9. Children's Privacy</h2>
            <p>
              Our Service is not intended for children under 13.
            </p>
            <p className="mt-4">
              We do not knowingly collect personal data from children. If you believe a child has provided us information, contact us immediately at <a href="mailto:support@chessdata.app" className="text-sky-400 hover:text-sky-300 underline">support@chessdata.app</a> and we will delete it.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mt-8 mb-4">10. International Users</h2>
            <p>
              Your data may be transferred to and processed in countries where our partners operate, including the United States and the EU.
            </p>
            <p className="mt-4">
              <strong>GDPR Compliance:</strong>
            </p>
            <p className="mt-2">
              If you are in the European Economic Area (EEA), you have additional rights, including:
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li>The right to object to certain processing</li>
              <li>The right to data portability</li>
            </ul>
            <p className="mt-4">
              Contact <a href="mailto:support@chessdata.app" className="text-sky-400 hover:text-sky-300 underline">support@chessdata.app</a> to exercise these rights.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mt-8 mb-4">11. Data Breach Notification</h2>
            <p>
              In the event of a data breach affecting your personal information, we will notify you and relevant authorities as required by law, providing details and recommended next steps.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mt-8 mb-4">12. Changes to This Privacy Policy</h2>
            <p>
              We may update this Policy from time to time.
            </p>
            <p className="mt-4">
              You will be notified of significant updates by:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Posting the new policy on this page</li>
              <li>Updating the "Last updated" date</li>
              <li>Email notification (for major changes)</li>
              <li>Displaying a notice within the Service</li>
            </ul>
            <p className="mt-4">
              Continued use of the Service after changes take effect constitutes acceptance of the revised Policy.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mt-8 mb-4">13. Contact Us</h2>
            <p>
              If you have any questions, concerns, or requests regarding this Privacy Policy, contact us at:
            </p>
            <p className="mt-4">
              📧 Email: <a href="mailto:support@chessdata.app" className="text-sky-400 hover:text-sky-300 underline">support@chessdata.app</a>
            </p>
            <p className="mt-4">
              We will respond within 30 days.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mt-8 mb-4">14. California Privacy Rights (CCPA)</h2>
            <p>
              If you are a California resident, you have additional rights under the California Consumer Privacy Act (CCPA):
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>The right to know what personal information we collect and how we use it</li>
              <li>The right to request deletion of your data</li>
              <li>The right to opt-out of the sale of your personal information (we do not sell any data)</li>
              <li>The right to non-discrimination for exercising these rights</li>
            </ul>
            <p className="mt-4">
              To exercise these rights, contact <a href="mailto:support@chessdata.app" className="text-sky-400 hover:text-sky-300 underline">support@chessdata.app</a>.
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
