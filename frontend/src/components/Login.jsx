// import React, { useState } from 'react';
// import { LogIn, BookOpen } from 'lucide-react';
// import toast from 'react-hot-toast';
// import { userAPI } from '../services/api';
// import './Login.css';

// const Login = ({ onLogin }) => {
//   const [username, setUsername] = useState('');
//   const [loading, setLoading] = useState(false);

//   const handleSubmit = async (e) => {
//     e.preventDefault();
    
//     if (!username.trim()) {
//       toast.error('Please enter a username');
//       return;
//     }

//     setLoading(true);
//     try {
//       const response = await userAPI.login(username.trim());
//       toast.success(response.message);
//       onLogin(response);
//     } catch (error) {
//       toast.error(error.response?.data?.detail || 'Login failed');
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//     <div className="login-container">
//       <div className="login-card">
//         <div className="login-header">
//           <BookOpen size={48} className="login-icon" />
//           <h1>Notes App</h1>
//           <p>Digitize and organize your handwritten notes</p>
//         </div>

//         <form onSubmit={handleSubmit} className="login-form">
//           <div className="form-group">
//             <label htmlFor="username">Username</label>
//             <input
//               id="username"
//               type="text"
//               value={username}
//               onChange={(e) => setUsername(e.target.value)}
//               placeholder="Enter your username"
//               disabled={loading}
//               autoFocus
//             />
//           </div>

//           <button type="submit" className="login-button" disabled={loading}>
//             {loading ? (
//               <>
//                 <span className="spinner"></span>
//                 Logging in...
//               </>
//             ) : (
//               <>
//                 <LogIn size={20} />
//                 Login / Sign Up
//               </>
//             )}
//           </button>
//         </form>

//         <div className="login-footer">
//           <p>New users will be automatically registered</p>
//         </div>
//       </div>
//     </div>
//   );
// };

// export default Login;
import { useState } from 'react';
import { authAPI } from '../services/api';
import toast from 'react-hot-toast';

function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState('login'); // login | signup | reset
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // const handleSubmit = async (e) => {
  //   e.preventDefault();
  //   setError('');
  //   setLoading(true);

  //   try {
  //     let userData;
      
  //     if (isSignup) {
  //       userData = await authAPI.signup(username, password);
  //     } else {
  //       userData = await authAPI.login(username, password);
  //     }
      
  //     onLogin(userData);
  //   } catch (err) {
  //     setError(err.response?.data?.detail || 'Authentication failed');
  //   } finally {
  //     setLoading(false);
  //   }
  // };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const normalizedEmail = email.trim().toLowerCase();

    try {
      if (mode === 'signup') {
        const userData = await authAPI.signup(normalizedEmail, password);
        toast.success('Account created successfully!');
        onLogin(userData);
        return;
      }

      if (mode === 'reset') {
        await authAPI.resetPassword(normalizedEmail, password);
        toast.success('Password updated. Please log in.');
        setMode('login');
        setPassword('');
        return;
      }

      const userData = await authAPI.login(normalizedEmail, password);
      toast.success('Logged in successfully!');
      onLogin(userData);
    } catch (err) {
      const errorMessage = err.response?.data?.detail || err.message || 'Authentication failed';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <h2>
        {mode === 'signup' ? 'Sign Up' : mode === 'reset' ? 'Reset Password' : 'Login'}
      </h2>
      
      {error && <div className="error">{error}</div>}
      
      <form onSubmit={handleSubmit}>
        <input
          type="email"
          placeholder="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
        />
        
        <button type="submit" disabled={loading}>
          {loading
            ? 'Loading...'
            : mode === 'signup'
              ? 'Sign Up'
              : mode === 'reset'
                ? 'Update Password'
                : 'Login'}
        </button>
      </form>

      <button
        type="button"
        onClick={() => {
          setMode(mode === 'signup' ? 'login' : 'signup');
          setError('');
        }}
      >
        {mode === 'signup' ? 'Already have an account? Login' : 'Need an account? Sign Up'}
      </button>

      <button
        type="button"
        onClick={() => {
          setMode(mode === 'reset' ? 'login' : 'reset');
          setError('');
        }}
      >
        {mode === 'reset' ? 'Back to Login' : 'Forgot password?'}
      </button>
    </div>
  );
}

export default Login;
