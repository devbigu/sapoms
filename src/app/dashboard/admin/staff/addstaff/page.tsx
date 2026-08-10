'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const roleOptions = [
  { value: 'EXECUTIVE', label: 'Executive', authRole: 'STAFF', staffRoleType: '1', successMessage: 'Executive created' },
  { value: 'FIELD_EXECUTIVE', label: 'Field Executive', authRole: 'STAFF', staffRoleType: '2', successMessage: 'Field Executive created' },
  { value: 'RSM', label: 'RSM', authRole: 'RSM', staffRoleType: 'RSM', successMessage: 'RSM created' },
  { value: 'NSM', label: 'NSM', authRole: 'NSM', staffRoleType: undefined, successMessage: 'NSM created' },
] as const

const regionOptions = [
  { value: 'NORTH', label: 'North' },
  { value: 'SOUTH', label: 'South' },
  { value: 'EAST', label: 'East' },
  { value: 'WEST', label: 'West' },
] as const

type StaffFormRole = '' | typeof roleOptions[number]['value']

function getRoleOption(value: StaffFormRole) {
  return roleOptions.find((option) => option.value === value)
}

function InputField({
  label, value, onChange, type = "text", placeholder, required = true
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  placeholder?: string
  required?: boolean
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">{label}</label>
      <input
        required={required}
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder || label}
        className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
      />
    </div>
  )
}

export default function AddStaffPage() {
  const router = useRouter()
  const [isSaving, setIsSaving] = useState(false)
  const [toastMsg, setToastMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null)
  const [name, setName] = useState("")
  const [designation, setDesignation] = useState("")
  const [location, setLocation] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [role, setRole] = useState<StaffFormRole>('')
  const [salesRegion, setSalesRegion] = useState("")

  const showToast = (text: string, type: 'success' | 'error') => {
    setToastMsg({ text, type })
    setTimeout(() => setToastMsg(null), 3500)
  }

  const resetForm = () => {
    setName("")
    setDesignation("")
    setLocation("")
    setEmail("")
    setPassword("")
    setRole('')
    setSalesRegion("")
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const selectedRole = getRoleOption(role)
    if (!selectedRole) return
    setIsSaving(true)
    try {
      const response = await fetch("/api/admin/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name,
          designation,
          location,
          email,
          password,
          role: selectedRole.authRole,
          staffRoleType: selectedRole.staffRoleType,
          salesRegion: selectedRole.authRole === "RSM" ? salesRegion : undefined,
        }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok || payload?.success === false) throw new Error(payload?.message || "Failed to add user")
      showToast(selectedRole.successMessage, 'success')
      resetForm()
      router.push("/dashboard/admin/staff/stafflist")
    } catch {
      showToast("Failed to add user", 'error')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {toastMsg && (
        <div className={`fixed top-5 right-5 z-50 text-sm px-4 py-3 rounded-lg shadow-lg transition-all ${
          toastMsg.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-500 text-white'
        }`}>
          {toastMsg.text}
        </div>
      )}

      <div className="p-6 max-w-3xl mx-auto">
        <div className="mb-8">
          <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4 transition">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Back
          </button>
          <h1 className="text-3xl font-bold text-gray-900">Add Staff</h1>
          <p className="text-sm text-gray-500 mt-1">Create an internal staff account</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="flex flex-col gap-6">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-5 pb-3 border-b border-gray-100">Personal Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <InputField label="Full Name" value={name} onChange={setName} placeholder="Enter full name" />
                <InputField label="Designation" value={designation} onChange={setDesignation} placeholder="e.g. Sales Manager" required={false} />
                <InputField label="Email" value={email} onChange={setEmail} type="email" placeholder="user@company.com" />
                <InputField label="Location" value={location} onChange={setLocation} type="text" placeholder="City / Branch" required={false} />
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-5 pb-3 border-b border-gray-100">Account Settings</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <InputField label="Password" value={password} onChange={setPassword} type="password" placeholder="Set a password" />
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">Role</label>
                  <select
                    required
                    value={role}
                    onChange={e => {
                      const nextRole = e.target.value as StaffFormRole
                      setRole(nextRole)
                      if (nextRole !== "RSM") setSalesRegion("")
                    }}
                    className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                  >
                    <option value="" disabled>Select a role</option>
                    {roleOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
                {role === "RSM" && (
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">Region</label>
                    <select required value={salesRegion} onChange={e => setSalesRegion(e.target.value)} className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition">
                      <option value="" disabled>Select region</option>
                      {regionOptions.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pb-6">
              <button type="button" onClick={() => router.back()} className="px-5 py-2.5 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition">Cancel</button>
              <button type="submit" disabled={isSaving} className="flex items-center gap-2 px-6 py-2.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition font-medium">
                {isSaving && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                {isSaving ? "Saving..." : "Add Staff"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
