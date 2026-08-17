'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Eye, EyeOff } from 'lucide-react'
type DealerStatus = "active" | "inactive" | "suspended"

function normalizeDealerStatus(value: unknown): DealerStatus {
  const normalized = String(value ?? "").trim().toLowerCase()
  if (normalized === "active") return "active"
  if (normalized === "suspended") return "suspended"
  return "inactive"
}

function toApiStatus(value: DealerStatus) {
  return value === "active" ? "ACTIVE" : value === "suspended" ? "SUSPENDED" : "INACTIVE"
}

type StaffOption = {
  staff_id: string
  staff_name: string
  staff_roletype: string
  role?: string
  status?: string
}

type DiagnosticPassword = {
  id: string
  expiresAt: string
  revokedAt: string | null
  lastUsedAt: string | null
  createdAt: string
  createdBy: string
}

const ADMIN_DEALERS_URL = "/api/admin/dealers"
const ADMIN_STAFF_URL = "/api/admin/staff"
const DEALER_LIST_ROUTE = "/dashboard/admin/dealer/DealerList"

async function parseJsonResponse<T>(res: Response): Promise<T> {
  const text = await res.text()
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  if (/^\s*</.test(text)) throw new Error("Expected JSON but received HTML")
  try {
    return JSON.parse(text) as T
  } catch {
    throw new Error("Invalid JSON response")
  }
}

function staffRoleLabel(staff: StaffOption) {
  const roleType = String(staff.staff_roletype || staff.role || "").toUpperCase()
  if (roleType === "1") return "Exe"
  if (roleType === "2") return "Field Exe"
  if (roleType === "RSM") return "RSM"
  if (roleType === "ASM") return "ASM"
  return "Staff"
}

function splitCsv(value: unknown) {
  if (Array.isArray(value)) return value.map(String).map(s => s.trim()).filter(Boolean)
  return String(value || "").split(",").map(s => s.trim()).filter(Boolean)
}

function InputField({
  label, value, onChange, type = "text", placeholder, required = true, hint,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  placeholder?: string
  required?: boolean
  hint?: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">
        {label}
        {required && <span className="text-orange-500 ml-0.5">*</span>}
      </label>
      <input
        required={required}
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder || label}
        className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
      />
      {hint && <p className="text-[11px] text-gray-400">{hint}</p>}
    </div>
  )
}

export default function EditDealerPage() {
  const router = useRouter()
  const params = useParams()
  const dealerId = String(params.dealerId || "")

  const [isLoading,  setIsLoading]  = useState(false)
  const [isSaving,   setIsSaving]   = useState(false)
  const [toastMsg,   setToastMsg]   = useState<{ text: string; type: 'success' | 'error' } | null>(null)
  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([])
  const [selectedStaffToAdd, setSelectedStaffToAdd] = useState("")

  // Form fields
  const [name,           setName]           = useState("")
  const [email,          setEmail]          = useState("")
  const [number,         setNumber]         = useState("")
  const [city,           setCity]           = useState("")
  const [address,        setAddress]        = useState("")
  const [pincode,        setPincode]        = useState("")
  const [username,       setUsername]       = useState("")
  const [diagnosticPassword, setDiagnosticPassword] = useState("")
  const [dealercode,     setDealercode]     = useState("")
  const [gst,            setGst]            = useState("")
  const [discount,       setDiscount]       = useState("")
  const [creditdays,     setCreditdays]     = useState("")
  const [annualtarget,   setAnnualtarget]   = useState("")
  const [currentlimit,   setCurrentlimit]   = useState("")
  const [notes,          setNotes]          = useState("")
  const [dealerid,       setDealerid]       = useState("")
  const [status,         setStatus]         = useState<DealerStatus>("active")
  const [statusSaving,   setStatusSaving]   = useState(false)
  const [showDiagnosticPassword, setShowDiagnosticPassword] = useState(false)
  const [diagnosticExpiryHours, setDiagnosticExpiryHours] = useState("24")
  const [diagnosticSaving, setDiagnosticSaving] = useState(false)
  const [diagnosticRevoking, setDiagnosticRevoking] = useState(false)
  const [activeDiagnosticPassword, setActiveDiagnosticPassword] = useState<DiagnosticPassword | null>(null)
  const [assignedStaffIds, setAssignedStaffIds] = useState<string[]>([])
  const [initialAssignedStaffIds, setInitialAssignedStaffIds] = useState<string[]>([])
  const [existingStaffNames, setExistingStaffNames] = useState("")

  // Toast auto-dismiss
  useEffect(() => {
    if (!toastMsg) return
    const t = setTimeout(() => setToastMsg(null), 3500)
    return () => clearTimeout(t)
  }, [toastMsg])

  useEffect(() => {
    let active = true

    const loadDealer = async () => {
      if (!dealerId) return
      setIsLoading(true)
      try {
        const res = await fetch(`${ADMIN_DEALERS_URL}/${encodeURIComponent(dealerId)}`, { credentials: "include" })
        const json = await parseJsonResponse<any>(res)
        if (!active) return
        if (json.status) {
          const d = json.data
          setName(d.Dealer_Name        || "")
          setEmail(d.Dealer_Email       || "")
          setNumber(d.Dealer_Number     || "")
          setCity(d.Dealer_City         || "")
          setPincode(d.Dealer_Pincode   || "")
          setAddress(d.Dealer_Address   || "")
          setUsername(d.Dealer_Username || "")
          setDiscount(d.discount        || "")
          setDealercode(d.Dealer_Dealercode || "")
          setGst(d.gst                  || "")
          setCreditdays(d.creditdays    || "")
          setNotes(d.Dealer_Notes       || "")
          setDealerid(d.Dealer_Id       || "")
          setAnnualtarget(d.annualtarget || "")
          setCurrentlimit(d.currentlimit || "")
          setExistingStaffNames(d.staffname || "")
          const initialStaffIds = splitCsv(d.assignedstaff)
          setAssignedStaffIds(initialStaffIds)
          setInitialAssignedStaffIds(initialStaffIds)
          setStatus(normalizeDealerStatus(d.status))
        } else {
          setToastMsg({ text: json.msz || "Failed to load dealer", type: 'error' })
        }
      } catch {
        if (active) setToastMsg({ text: "Failed to load dealer data", type: 'error' })
      } finally {
        if (active) setIsLoading(false)
      }
    }

    const loadDiagnosticPassword = async () => {
      try {
        const res = await fetch(`${ADMIN_DEALERS_URL}/${encodeURIComponent(dealerId)}/diagnostic-password`, { credentials: "include" })
        const json = await parseJsonResponse<any>(res)
        if (active) setActiveDiagnosticPassword(json.data || null)
      } catch {
        if (active) setActiveDiagnosticPassword(null)
      }
    }

    const loadStaff = async () => {
      try {
        const res = await fetch(`${ADMIN_STAFF_URL}?page=1&limit=100`, { credentials: "include" })
        const json = await parseJsonResponse<any>(res)
        if (active) {
          setStaffOptions((json.data || []).filter((staff: StaffOption) => {
            const role = String(staff.role || "").toUpperCase()
            const status = String(staff.status || "").toUpperCase()
            return ["STAFF", "RSM", "ASM"].includes(role) && (!status || status === "ACTIVE")
          }))
        }
      } catch {
        console.error("Failed to fetch staff")
      }
    }

    loadDealer()
    loadDiagnosticPassword()
    loadStaff()
    return () => { active = false }
  }, [dealerId])

  const handleStaffSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setAssignedStaffIds(Array.from(e.target.selectedOptions, o => o.value))
  }

  // Derive staffname string from current selection (matches what AddDealerForm does)
  const getStaffNames = () =>
    assignedStaffIds
      .map(id => staffOptions.find(s => s.staff_id === id)?.staff_name ?? "")
      .filter(Boolean)
      .join(",") || existingStaffNames

  const handleDiagnosticPasswordSave = async () => {
    const resolvedDealerId = dealerid || dealerId
    if (!resolvedDealerId) {
      setToastMsg({ text: "Missing dealer id", type: "error" })
      return
    }
    if (diagnosticPassword.length < 5) {
      setToastMsg({ text: "Diagnostic password must be at least 5 characters", type: "error" })
      return
    }

    setDiagnosticSaving(true)
    try {
      const response = await fetch(`${ADMIN_DEALERS_URL}/${encodeURIComponent(resolvedDealerId)}/diagnostic-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ password: diagnosticPassword, expiryHours: diagnosticExpiryHours }),
      })
      const payload = await response.json()
      if (!response.ok || !payload.success) throw new Error(payload.message ?? "Failed to save diagnostic password")
      setActiveDiagnosticPassword(payload.data || null)
      setToastMsg({ text: "Diagnostic password saved", type: "success" })
    } catch (error) {
      setToastMsg({ text: error instanceof Error ? error.message : "Failed to save diagnostic password", type: "error" })
    } finally {
      setDiagnosticSaving(false)
    }
  }

  const handleDiagnosticPasswordRevoke = async () => {
    const resolvedDealerId = dealerid || dealerId
    if (!resolvedDealerId) return
    setDiagnosticRevoking(true)
    try {
      const response = await fetch(`${ADMIN_DEALERS_URL}/${encodeURIComponent(resolvedDealerId)}/diagnostic-password`, {
        method: "DELETE",
        credentials: "include",
      })
      const payload = await response.json()
      if (!response.ok || !payload.success) throw new Error(payload.message ?? "Failed to revoke diagnostic password")
      setActiveDiagnosticPassword(null)
      setToastMsg({ text: "Diagnostic password revoked", type: "success" })
    } catch (error) {
      setToastMsg({ text: error instanceof Error ? error.message : "Failed to revoke diagnostic password", type: "error" })
    } finally {
      setDiagnosticRevoking(false)
    }
  }

  const copyDiagnosticPassword = async () => {
    if (!diagnosticPassword) return
    await navigator.clipboard?.writeText(diagnosticPassword)
    setToastMsg({ text: "Diagnostic password copied", type: "success" })
  }

  const handleStatusSave = async () => {
    const resolvedDealerId = dealerid || dealerId
    if (!resolvedDealerId) {
      setToastMsg({ text: "Missing dealer id", type: 'error' })
      return
    }

    setStatusSaving(true)
    try {
      const response = await fetch(`${ADMIN_DEALERS_URL}/${encodeURIComponent(resolvedDealerId)}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: toApiStatus(normalizeDealerStatus(status)) }),
      })
      const payload = await response.json()
      if (!response.ok || !payload.success) throw new Error(payload.message ?? "Failed to update dealer status")
      setToastMsg({ text: `Dealer marked ${status === "active" ? "active" : "inactive"}`, type: 'success' })
    } catch {
      setToastMsg({ text: "Failed to update dealer status", type: 'error' })
    } finally {
      setStatusSaving(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const normalizedStaffIds = Array.from(new Set(assignedStaffIds.map((id) => id.trim()).filter(Boolean))).sort()
    const initialNormalizedStaffIds = Array.from(new Set(initialAssignedStaffIds.map((id) => id.trim()).filter(Boolean))).sort()
    const staffChanged = normalizedStaffIds.length !== initialNormalizedStaffIds.length
      || normalizedStaffIds.some((id, index) => id !== initialNormalizedStaffIds[index])

    if (!normalizedStaffIds.length) {
      setToastMsg({ text: "Please assign at least one staff member", type: 'error' })
      return
    }
    const resolvedDealerId = dealerid || dealerId
    if (!resolvedDealerId) {
      setToastMsg({ text: "Missing dealer id", type: 'error' })
      return
    }
    setIsSaving(true)
    try {
      const updateResponse = await fetch(`${ADMIN_DEALERS_URL}/${encodeURIComponent(resolvedDealerId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          businessName: name,
          email,
          phone: number,
          city,
          address,
          pincode,
          dealerCode: dealercode,
          gstin: gst,
          discountPercent: discount,
          creditDays: creditdays,
          creditLimitPaise: currentlimit,
        }),
      })
      const updatePayload = await updateResponse.json()
      if (!updateResponse.ok || !updatePayload.success) throw new Error(updatePayload.message ?? "Failed to update dealer")

      if (staffChanged) {
        const staffResponse = await fetch(ADMIN_DEALERS_URL + "/" + encodeURIComponent(resolvedDealerId) + "/staff", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ staffIds: normalizedStaffIds }),
        })
        const staffPayload = await staffResponse.json()
        if (!staffResponse.ok || !staffPayload.success) throw new Error(staffPayload.message ?? "Failed to update staff assignments")
        setExistingStaffNames(getStaffNames())
        setInitialAssignedStaffIds(normalizedStaffIds)
      }
      setToastMsg({ text: "Dealer updated successfully", type: 'success' })
    } catch {
      setToastMsg({ text: "Failed to update dealer", type: 'error' })
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Loading dealer data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">

      {/* Toast */}
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

      <div className="p-6 admin-page-shell">

        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push(DEALER_LIST_ROUTE)}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4 transition"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Back to Dealer List
          </button>
          <h1 className="text-3xl font-bold text-gray-900">Edit Dealer</h1>
          <p className="text-sm text-gray-500 mt-1">Update dealer information and settings</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="flex flex-col gap-6">

            {/* Basic Info */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-5 pb-3 border-b border-gray-100">
                Basic Information
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <InputField label="Name"             value={name}    onChange={setName}    placeholder="Full name" />
                <InputField label="Email Address"    value={email}   onChange={setEmail}   type="email" placeholder="dealer@email.com" />
                <InputField label="WhatsApp Number"  value={number}  onChange={setNumber}  type="number" placeholder="10-digit number" />
                <InputField label="City"             value={city}    onChange={setCity}    placeholder="City / Location" />
                <InputField label="Address"          value={address} onChange={setAddress} placeholder="Street address" />
                <InputField label="Pin Code"         value={pincode} onChange={setPincode} type="number" placeholder="6-digit pin code" />
              </div>
            </div>

            {/* Account & Auth */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-5 pb-3 border-b border-gray-100">
                Account &amp; Credentials
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <InputField label="Dealer Code" value={dealercode} onChange={setDealercode} placeholder="Unique dealer code" />
                <InputField label="Username"    value={username}   onChange={setUsername}   placeholder="Login username" />
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                    Diagnostic Password
                  </label>
                  <div className="relative">
                    <input
                      type={showDiagnosticPassword ? "text" : "password"}
                      value={diagnosticPassword}
                      onChange={e => setDiagnosticPassword(e.target.value)}
                      placeholder="Temporary testing password"
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 pr-10 text-sm text-gray-900 placeholder-gray-400 transition focus:border-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowDiagnosticPassword(value => !value)}
                      className="absolute inset-y-0 right-2 flex items-center rounded-md px-2 text-gray-400 transition hover:text-indigo-600"
                      aria-label={showDiagnosticPassword ? "Hide diagnostic password" : "Show diagnostic password"}
                      title={showDiagnosticPassword ? "Hide password" : "Show password"}
                    >
                      {showDiagnosticPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      max="2160"
                      value={diagnosticExpiryHours}
                      onChange={e => setDiagnosticExpiryHours(e.target.value)}
                      aria-label="Diagnostic password expiry in hours"
                      className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <button type="button" onClick={copyDiagnosticPassword} disabled={!diagnosticPassword} className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50">
                      Copy
                    </button>
                    <button type="button" onClick={handleDiagnosticPasswordSave} disabled={diagnosticSaving || diagnosticPassword.length < 5} className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50">
                      {diagnosticSaving ? "Saving..." : "Save"}
                    </button>
                  </div>
                  {activeDiagnosticPassword ? (
                    <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-700">
                      Active until {new Date(activeDiagnosticPassword.expiresAt).toLocaleString()}.
                      {activeDiagnosticPassword.lastUsedAt ? ` Last used ${new Date(activeDiagnosticPassword.lastUsedAt).toLocaleString()}.` : " Not used yet."}
                      <button type="button" onClick={handleDiagnosticPasswordRevoke} disabled={diagnosticRevoking} className="ml-2 font-semibold text-emerald-800 underline disabled:opacity-50">
                        {diagnosticRevoking ? "Revoking..." : "Revoke"}
                      </button>
                    </div>
                  ) : (
                    <p className="text-[11px] text-gray-400">Dealer original password remains unchanged. Expiry is in hours, from 1 to 2160.</p>
                  )}
                </div>
                <InputField label="GST No."     value={gst}        onChange={setGst}        placeholder="15-character GST number" />
              </div>
            </div>

            {/* Financial */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-5 pb-3 border-b border-gray-100">
                Financial Settings
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <InputField label="Discount %"     value={discount}     onChange={setDiscount}     type="number" placeholder="e.g. 10" />
                <InputField label="Credit Days"    value={creditdays}   onChange={setCreditdays}   type="number" placeholder="e.g. 30" />
                <InputField label="Annual Target"  value={annualtarget} onChange={setAnnualtarget} type="number" placeholder="Amount in Rs" />
                <InputField label="Current Limit"  value={currentlimit} onChange={setCurrentlimit} type="number" placeholder="Credit limit in Rs" />
              </div>
            </div>

            {/* Status */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-5 pb-3 border-b border-gray-100">
                Account Status
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                    Dealer Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(normalizeDealerStatus(e.target.value))}
                    className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                  <p className="text-[11px] text-gray-400">
                    Inactive dealers will still remain in the list, but access checks will block the account.
                  </p>
                  <button
                    type="button"
                    onClick={handleStatusSave}
                    disabled={statusSaving}
                    className="mt-2 inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {statusSaving ? "Saving..." : "Save Status"}
                  </button>
                </div>
              </div>
            </div>

            {/* Staff Assignment */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-5 pb-3 border-b border-gray-100">
                Staff Assignment
              </h2>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                  Assign Staff
                  <span className="text-orange-500 ml-0.5">*</span>
                  <span className="ml-2 text-gray-400 normal-case font-normal">(hold Ctrl / Cmd to select multiple)</span>
                </label>
                <div className="mt-2 flex gap-2 items-center">
                  <select
                    value={selectedStaffToAdd}
                    onChange={(e) => setSelectedStaffToAdd(e.target.value)}
                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 bg-white focus:outline-none"
                  >
                    <option value="">Select staff to add</option>
                    {staffOptions.map(staff => (
                      <option key={staff.staff_id} value={staff.staff_id}>
                        {staff.staff_name} ({staffRoleLabel(staff)})
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      if (!selectedStaffToAdd) return
                      setAssignedStaffIds(prev => prev.includes(selectedStaffToAdd) ? prev : [...prev, selectedStaffToAdd])
                      setSelectedStaffToAdd("")
                    }}
                    className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700"
                  >
                    Add
                  </button>
                </div>
                <select
                  multiple
                  value={assignedStaffIds}
                  onChange={handleStaffSelect}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition h-40"
                >
                  {staffOptions.map(staff => (
                    <option key={staff.staff_id} value={staff.staff_id}>
                      {staff.staff_name} ({staffRoleLabel(staff)})
                    </option>
                  ))}
                </select>

                {/* Selected staff chips */}
                {assignedStaffIds.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {assignedStaffIds.map(sid => {
                      const staff = staffOptions.find(s => s.staff_id === sid)
                      return staff ? (
                        <span key={sid} className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 text-xs font-medium px-2.5 py-1 rounded-full border border-indigo-100">
                          {staff.staff_name}
                          <button
                            type="button"
                            onClick={() => setAssignedStaffIds(prev => prev.filter(s => s !== sid))}
                            className="text-indigo-400 hover:text-indigo-700 ml-0.5"
                          >
                            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                              <path d="M18 6 6 18M6 6l12 12"/>
                            </svg>
                          </button>
                        </span>
                      ) : null
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Notes */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-5 pb-3 border-b border-gray-100">
                Notes
              </h2>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">Internal Notes</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={4}
                  placeholder="Add any notes about this dealer..."
                  className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition resize-none"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pb-6">
              <button
                type="button"
                onClick={() => router.push(DEALER_LIST_ROUTE)}
                className="px-5 py-2.5 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="flex items-center gap-2 px-6 py-2.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition font-medium"
              >
                {isSaving && (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                )}
                {isSaving ? "Saving..." : "Save Changes"}
              </button>
            </div>

          </div>
        </form>
      </div>
    </div>
  )
}
