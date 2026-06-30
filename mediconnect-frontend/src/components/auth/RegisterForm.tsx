import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuth } from '../../context/AuthContext';
import { validatePassword } from '../../utils/passwordValidator';

const RegisterForm: React.FC = () => {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    role: 'user' as 'user' | 'doctor',
  });
  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const check = validatePassword(form.password);
    if (!check.valid) {
      setErrors(check.errors);
      return;
    }
    setErrors([]);
    setSubmitting(true);
    try {
      await register(form);
      toast.success('Registration successful. Please log in.');
      navigate('/login');
    } catch (err: any) {
      const data = err?.response?.data;
      if (Array.isArray(data?.errors)) setErrors(data.errors);
      toast.error(data?.message || 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 12, maxWidth: 360 }}>
      <h2>Create account</h2>
      <input name="name" placeholder="Full name" value={form.name} onChange={handleChange} required />
      <input name="email" type="email" placeholder="Email" value={form.email} onChange={handleChange} required />
      <input name="phone" placeholder="Phone" value={form.phone} onChange={handleChange} required />
      <input name="password" type="password" placeholder="Password" value={form.password} onChange={handleChange} required />
      <select name="role" value={form.role} onChange={handleChange}>
        <option value="user">Patient</option>
        <option value="doctor">Doctor</option>
      </select>
      {errors.length > 0 && (
        <ul style={{ color: '#dc2626', margin: 0 }}>
          {errors.map((err) => (
            <li key={err}>{err}</li>
          ))}
        </ul>
      )}
      <button type="submit" disabled={submitting}>
        {submitting ? 'Creating...' : 'Register'}
      </button>
    </form>
  );
};

export default RegisterForm;
