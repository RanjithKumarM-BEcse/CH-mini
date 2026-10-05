import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is logged in by looking for a token
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    
    if (token && storedUser) {
      setUser(JSON.parse(storedUser));
      // Optional: Verify token with backend here if you want extra security
    }
    setLoading(false);
  }, []);

  const login = async (googleCredentialResponse) => {
    try {
      const response = await axios.post(`${process.env.REACT_APP_API_URL}/auth/google`, {
        token: googleCredentialResponse.credential
      });
      
      const { token, user } = response.data;
      
      // Save to local storage
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      
      setUser(user);
      return true;
    } catch (error) {
      console.error('Login failed:', error);
      if (error.response && error.response.data) {
        console.error('Exact Backend Error:', error.response.data.details);
      }
      return false;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
