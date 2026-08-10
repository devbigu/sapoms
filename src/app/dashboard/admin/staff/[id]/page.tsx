'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'

const ADMIN_STAFF_URL = "/api/admin/staff"
const STAFF_LIST_ROUTE = "/dashboard/admin/staff/stafflist"

const roleOptions = [
  { value: 'EXECUTIVE', label: 'Executive', authRole: 'STAFF', staffRoleType: '1' },
  { value: 'FIELD_EXECUTIVE', label: 'Field Executive', authRole: 'STAFF', staffRoleType: '2' },
  { value: 'RSM', label: 'RSM', authRole: 'RSM', staffRoleType: 'RSM' },
  { value: 'NSM', label: 'NSM', authRole: 'NSM', staffRoleType: undefined },
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

function toFormRole(data: { role?: string; staff_roletype?: string; staffRoleType?: string }): StaffFormRole {
  if (data.role === 'RSM') return 'RSM'
  if (data.role === 'NSM') return 'NSM'
  const staffType = data.staff_roletype || data.staffRoleType
  if (staffType === '2') return 'FIELD_EXECUTIVE'
  if (staffType === '1') return 'EXECUTIVE'
  return ''
}

function InputField({
  label, value, onChange, type = "text", placeholder, required = true, disabled = false,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  placeholder?: string
  required?: boolean
  disabled?: boolean
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">
        {label}
        {required && <span className="text-orange-500 ml-0.5">*</span>}
      </label>
      <input
        required={required}
        disabled={disabled}
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder || label}
        className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition disabled:bg-gray-50 disabled:text-gray-500"
      />
    </div>
  )
}

export default function EditStaffPage() {
  const router = useRouter()
  const params = useParams()
  const id = String(params.id || "")

  const [isLoading, setIsLoading] = useState(false)
  const [isSaving,  setIsSaving]  = useState(false)
  const [toastMsg,  setToastMsg]  = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  const [staffid,     setStaffid]     = useState("")
  const [name,        setName]        = useState("")
  const [designation, setDesignation] = useState("")
  const [location,    setLocation]    = useState("")
  const [email,       setEmail]       = useState("")
  const [username,    setUsername]    = useState("")
  const [role,        setRole]        = useState<StaffFormRole>('')
  const [salesRegion, setSalesRegion] = useState("")

  useEffect(() => {
    if (!toastMsg) return
    const t = setTimeout(() => setToastMsg(null), 3500)
    return () => clearTimeout(t)
  }, [toastMsg])

  useEffect(() => {
    if (!id) return
    const fetchStaff = async () => {
      setIsLoading(true)
      try {
        const res = await fetch(`${ADMIN_STAFF_URL}/${encodeURIComponent(id)}`, { credentials: "include" })
        const json = await res.json()
        if (json.success || json.status) {
          const d = json.data
          setName(d.staff_name || d.name || "")
          setEmail(d.staff_email || d.email || "")
          setDesignation(d.staff_designation || d.designation || "")
          setLocation(d.staff_location || d.location || "")
          setUsername(d.staff_username || d.username || d.staff_email || d.email || "")
          setRole(toFormRole(d))
          setSalesRegion(d.sales_region || d.salesRegion || "")
          setStaffid(d.staff_id || d.id || "")
        } else {
          setToastMsg({ text: json.message || json.msz || "Failed to load staff", type: 'error' })
        }
      } catch {
        setToastMsg({ text: "Failed to load staff data", type: 'error' })
      } finally {
        setIsLoading(false)
      }
    }
    fetchStaff()
  }, [id])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const resolvedStaffId = staffid || id
    const selectedRole = getRoleOption(role)
    if (!resolvedStaffId) {
      setToastMsg({ text: "Missing staff id", type: 'error' })
      return
    }
    if (!selectedRole) return
    setIsSaving(true)
    try {
      const response = await fetch(`${ADMIN_STAFF_URL}/${encodeURIComponent(resolvedStaffId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name,
          email,
          designation,
          location,
          role: selectedRole.authRole,
          staffRoleType: selectedRole.staffRoleType,
          salesRegion: selectedRole.authRole === "RSM" ? salesRegion : undefined,
        }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok || payload?.success === false) throw new Error(payload?.message || "Failed to update staff")
      setToastMsg({ text: "Staff updated successfully", type: 'success' })
      router.push(STAFF_LIST_ROUTE)
    } catch (error) {
      setToastMsg({ text: error instanceof Error ? error.message : "Failed to update staff", type: 'error' })
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Loading staff data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {toastMsg && (
        <div className={`fixed top-5 right-5 z-50 text-sm px-4 py-3 rounded-lg shadow-lg transition-all flex items-center gap-2 ${
          toastMsg.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-500 text-white'
        }`}>
          {toastMsg.type === 'success'
            ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6 9 17l-5-5"/></svg>
            : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/></svg>
          }
          {toastMsg.text}
        </div>
      )}

      <div className="p-6 max-w-3xl mx-auto">
        <div className="mb-8">
          <button onClick={() => router.push(STAFF_LIST_ROUTE)} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4 transition">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Back to Staff List
          </button>
          <h1 className="text-3xl font-bold text-gray-900">Edit Staff</h1>
          <p className="text-sm text-gray-500 mt-1">Update staff member information</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="flex flex-col gap-6">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-5 pb-3 border-b border-gray-100">Personal Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <InputField label="Full Name" value={name} onChange={setName} placeholder="Enter full name" />
                <InputField label="Designation" value={designation} onChange={setDesignation} placeholder="e.g. Sales Manager" required={false} />
                <InputField label="Email" value={email} onChange={setEmail} type="email" placeholder="staff@company.com" />
                <InputField label="Location" value={location} onChange={setLocation} placeholder="City / Branch" required={false} />
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-5 pb-3 border-b border-gray-100">Account Settings</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <InputField label="Username" value={username} onChange={setUsername} placeholder="Login username" required={false} disabled />
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                    Role
                    <span className="text-orange-500 ml-0.5">*</span>
                  </label>
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
                    <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                      Region
                      <span className="text-orange-500 ml-0.5">*</span>
                    </label>
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
              <button type="button" onClick={() => router.push(STAFF_LIST_ROUTE)} className="px-5 py-2.5 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition">Cancel</button>
              <button type="submit" disabled={isSaving} className="flex items-center gap-2 px-6 py-2.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition font-medium">
                {isSaving && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                {isSaving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
