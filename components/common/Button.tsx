// Define the props interface for the LogoutButton
interface LogoutButtonProps {
  callbackUrl: string; // The URL to redirect to after signing out
  signOut: (options: { callbackUrl: string }) => void; // Function to call for signing out
}

const LogoutButton: React.FC<LogoutButtonProps> = ({
  callbackUrl,
  signOut,
}) => {
  return (
    <button
      onClick={() => signOut({ callbackUrl })}
      className="w-full bg-blue-500 text-white py-2 rounded"
    >
      Logout
    </button>
  );
};

export default LogoutButton;
