import { t } from '../i18n';

function SignInModal({ language, onClose, onSignIn }) {
  const L = t(language);
  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-lg p-6 w-full max-w-sm text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="float-right text-gray-400 hover:text-gray-600 text-lg leading-none">
          ×
        </button>
        <h3 className="text-lg font-bold text-green-800 mb-1">{L.signInModalTitle}</h3>
        <p className="text-sm text-gray-500 mb-5">{L.signInModalDesc}</p>
        <button
          onClick={onSignIn}
          className="w-full flex items-center justify-center gap-2 border rounded-lg py-2 font-medium text-gray-700 hover:bg-gray-50"
        >
          <span>🔵</span> {L.continueWithGoogle}
        </button>
      </div>
    </div>
  );
}

export default SignInModal;
