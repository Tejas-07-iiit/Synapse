import Link from "next/link";

export default function Home() {
  return (
    <div className="font-sans flex flex-col items-center justify-center min-h-screen bg-gray-50 px-6 py-12">
      <main className="max-w-md w-full text-center space-y-8 bg-white p-8 rounded-lg shadow-sm border border-gray-200">
        <div className="space-y-3">
          <span className="text-sm font-bold uppercase tracking-widest text-blue-600 block">
            Welcome to
          </span>
          <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl">
            SYNAPSE
          </h1>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
          <Link
            href="/login"
            className="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded text-center transition duration-200"
          >
            Login
          </Link>
          <Link
            href="/register"
            className="flex-1 py-3 px-4 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium rounded text-center transition duration-200"
          >
            Register
          </Link>
        </div>
      </main>
    </div>
  );
}
