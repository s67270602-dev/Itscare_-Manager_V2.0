
import React, { useState, useRef, useEffect } from 'react';
import {
  CheckCircle2, AlertCircle, User, Lock, LogIn, Import, PenTool, Send, LogOut, FileDown,
  RotateCcw, FileText, List, Printer, Save, Upload, FileJson, ChevronRight, Layout, Edit, Search, Archive
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { Contract, ContractFormState } from './types';
import { uid, addMonthsSafe, fmt, calculateSchedule } from './utils';
import SignaturePad from './components/SignaturePad';
import ContractPaper from './components/ContractPaper';

const DEFAULT_MANAGER_EMAIL = "itscare.clean@gmail.com";

// ✅ 하드코딩된 PIN 번호
const OWNER_PIN = "20094316";
const ENGINEER_PIN = "15777672";

// --- Types ---
type UserRole = 'owner' | 'engineer' | null;
type ViewState = 'loading' | 'login' | 'engineer_editor' | 'owner_dashboard' | 'owner_editor' | 'success';

const initialFormState: ContractFormState = {
  id: null,
  parentId: null,
  status: 'active',
  shopName: '',
  ownerName: '',
  contactNumber: '',
  address: '',
  region: '부산', // Default region
  model: '',
  capacity: '',
  quantity: 1,
  cycleMonths: 1,
  firstDate: '',
  contractStart: '',
  contractEnd: '',
  price: null,
  vat: 'VAT 포함',
  managerEmail: DEFAULT_MANAGER_EMAIL,
  scheduleMeta: null,
  signatureDataUrl: null,
  agree: {
    read: false,
    schedule: false,
    recalc: false,
    fault: false
  },
  signedDate: ''
};

function App() {
  // --- Auth & View State ---
  const [role, setRole] = useState<UserRole>(null);
  const [viewState, setViewState] = useState<ViewState>('login');
  const [pinInput, setPinInput] = useState('');
  const [authError, setAuthError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Mobile UI State
  const [mobileTab, setMobileTab] = useState<'form' | 'preview'>('form');

  // --- App State ---
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [form, setForm] = useState<ContractFormState>(initialFormState);
  
  // Dashboard State
  const [searchTerm, setSearchTerm] = useState('');
  const [regionFilter, setRegionFilter] = useState('전체'); // 전체, 부산, 울산, 양산, 김해
  
  // PDF & Print State
  const [pdfTarget, setPdfTarget] = useState<ContractFormState | null>(null);
  const [printTarget, setPrintTarget] = useState<ContractFormState | null>(null);

  const [sigPadKey, setSigPadKey] = useState(0);
  const [toast, setToast] = useState<{ msg: string, type: 'success' | 'error' } | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null); // Owner List File Input
  const editorFileInputRef = useRef<HTMLInputElement>(null); // Editor Draft Load Input
  const printRef = useRef<HTMLDivElement>(null);

  // --- Toast ---
  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // --- Auth Actions ---
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    const input = pinInput.trim();
    if (input === OWNER_PIN) {
      setRole('owner');
      setViewState('owner_dashboard');
      loadLocalContracts();
      setPinInput('');
    } else if (input === ENGINEER_PIN) {
      setRole('engineer');
      setViewState('engineer_editor');
      setPinInput('');
    } else {
      setAuthError('PIN 번호가 일치하지 않습니다.');
    }
  };

  const handleLogout = () => {
    setRole(null);
    setViewState('login');
    setForm(initialFormState);
    setContracts([]);
    setExpandedId(null);
    setPinInput('');
    setMobileTab('form');
    setSearchTerm('');
    setRegionFilter('전체');
  };

  const loadLocalContracts = () => {
    try {
      const stored = localStorage.getItem("itscare_contracts_v1");
      if (stored) setContracts(JSON.parse(stored));
    } catch (e) { }
  };

  const resetForm = () => {
    if (confirm("입력된 내용을 모두 초기화하시겠습니까?")) {
      setForm(initialFormState);
      setSigPadKey(prev => prev + 1);
      showToast("초기화되었습니다.");
    }
  };

  // --- JSON Save/Load Utility ---
  const handleSaveJson = (data: any, prefix: string) => {
    try {
        const fileName = `${prefix}_${fmt(new Date())}.json`;
        const jsonString = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonString], { type: "application/json" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast("JSON 파일로 저장되었습니다.");
    } catch (e) {
        console.error(e);
        showToast("저장 중 오류가 발생했습니다.", 'error');
    }
  };

  // --- PDF Download Handler ---
  const handleDownloadPdf = async (targetData: ContractFormState) => {
    setPdfTarget(targetData);
    showToast("PDF 변환 중...", 'success');
    setTimeout(async () => {
      const element = document.getElementById('hidden-pdf-template');
      if (!element) {
        showToast("PDF 템플릿 오류", 'error');
        setPdfTarget(null);
        return;
      }
      try {
        const canvas = await html2canvas(element, {
          scale: 2,
          useCORS: true,
          logging: false,
          windowWidth: 794,
        });
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        pdf.save(`contract_${targetData.shopName || 'download'}.pdf`);
        showToast("PDF 다운로드 완료");
      } catch (err) {
        console.error(err);
        showToast("PDF 생성 실패", 'error');
      } finally {
        setPdfTarget(null);
      }
    }, 300);
  };

  // --- Print Handler ---
  const handlePrint = (targetData: ContractFormState) => {
    setPrintTarget(targetData);
  };

  // Effect to trigger browser print when printTarget is set
  useEffect(() => {
    if (printTarget) {
      const timer = setTimeout(() => {
        window.print();
        setPrintTarget(null);
      }, 300); // Wait for render
      return () => clearTimeout(timer);
    }
  }, [printTarget]);

  // --- File Upload Handlers ---
  
  // 1. Owner Mode: Add to List (Backup)
  const handleListFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = event.target?.result as string;
        const data = JSON.parse(json);
        
        // Handle both single object and array of objects
        let newItems: Contract[] = [];
        if (Array.isArray(data)) {
            newItems = data;
        } else {
            newItems = [data];
        }

        setContracts(prev => {
            const currentIds = new Set(prev.map(c => c.id));
            const merged = [...prev];
            let addedCount = 0;

            newItems.forEach(item => {
                if (!item.shopName) return;
                // If ID missing, gen new. If ID exists, skip to prevent duplicates unless explicit logic added.
                if (!item.id) item.id = uid();
                
                if (!currentIds.has(item.id)) {
                    merged.push({
                        ...item,
                        region: item.region || '부산', // Default for legacy data
                        status: item.status || 'active'
                    });
                    addedCount++;
                }
            });
            
            if (addedCount > 0) {
                 localStorage.setItem("itscare_contracts_v1", JSON.stringify(merged));
                 showToast(`${addedCount}건의 계약서를 불러왔습니다.`);
                 return merged;
            } else {
                 showToast("새로운 데이터가 없습니다.");
                 return prev;
            }
        });
      } catch (err) {
        console.error(err);
        showToast("파일 형식이 올바르지 않습니다.", 'error');
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  // 2. Editor Mode: Load JSON into Form (Draft)
  const handleEditorFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = event.target?.result as string;
        const data = JSON.parse(json);
        
        if (!data.shopName && !data.ownerName) throw new Error("빈 데이터입니다.");

        if (confirm("작성 중인 내용이 사라지고, 불러온 데이터로 대체됩니다.\n계속하시겠습니까?")) {
            setForm({
                ...initialFormState,
                ...data,
                agree: { ...initialFormState.agree, ...(data.agree || {}) },
                id: null 
            });
            setSigPadKey(prev => prev + 1);
            showToast("데이터를 불러왔습니다.");
        }
      } catch (err) {
        console.error(err);
        showToast("올바른 JSON 파일이 아닙니다.", 'error');
      }
      if (editorFileInputRef.current) editorFileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };


  // --- Form Handlers ---
  const handleInputChange = (field: keyof ContractFormState, value: any) => {
    let nextValue = value;
    if (field === 'contactNumber' && typeof value === 'string') {
      nextValue = value.replace(/[^0-9]/g, '').replace(/^(\d{2,3})(\d{3,4})(\d{4})$/, `$1-$2-$3`);
    }
    setForm(prev => ({ ...prev, [field]: nextValue }));
  };

  const handleAgreeChange = (field: keyof ContractFormState['agree']) => {
    setForm(prev => ({
      ...prev,
      agree: { ...prev.agree, [field]: !prev.agree[field] }
    }));
  };

  const calcAutoSchedule = () => {
    const { cycleMonths, firstDate, contractStart, contractEnd } = form;
    const meta = calculateSchedule(cycleMonths, firstDate, contractStart, contractEnd);
    if (meta) {
      setForm(prev => ({ ...prev, scheduleMeta: meta }));
      showToast("일정 산정 완료");
    } else {
      showToast("날짜와 주기를 확인하세요.", 'error');
    }
  };

  const fillToday = () => {
    const now = new Date();
    const today = fmt(now);
    const endDate = fmt(addMonthsSafe(now, 12));
    setForm(prev => ({
      ...prev,
      contractStart: prev.contractStart || today,
      firstDate: prev.firstDate || today,
      contractEnd: prev.contractEnd || endDate,
    }));
  };

  const validateForm = (): string[] => {
    const errors = [];
    if (!form.shopName) errors.push("매장명");
    if (!form.ownerName) errors.push("대표자명");
    if (!form.contactNumber) errors.push("연락처");
    if (!form.address) errors.push("주소");
    if (!form.contractEnd) errors.push("계약 종료일");
    if (!form.scheduleMeta) errors.push("일정 산정");
    if (!form.agree.read) errors.push("계약서 확인 동의");
    if (!form.agree.schedule) errors.push("일정 산정 동의");
    if (!form.signatureDataUrl) errors.push("전자서명");
    return errors;
  };

  // --- Edit Handler (Owner) ---
  const handleEditContract = (c: Contract) => {
    if (!confirm(`[${c.shopName}] 계약서를 수정하시겠습니까?\n작성 화면으로 이동합니다.`)) return;
    
    // Explicitly set state to ensure editor loads correctly
    const newFormState = {
        ...initialFormState,
        ...c,
        agree: { ...initialFormState.agree, ...c.agree }
    };
    
    setForm(newFormState);
    setSigPadKey(prev => prev + 1); // Force signature pad reload
    setViewState('owner_editor');
  };

  // --- SUBMIT: Engineer (Send to Server) ---
  const handleSubmitContract = async () => {
    const errors = validateForm();
    if (errors.length > 0) {
      showToast(`[전송 불가] 확인 필요: ${errors.join(", ")}`, 'error');
      return;
    }

    if (!confirm("작성한 계약서를 본사로 제출하시겠습니까?\n제출 후에는 기기에서 데이터가 즉시 삭제됩니다.")) return;

    setIsSubmitting(true);

    try {
      const payload = {
        ...form,
        id: uid(),
        submittedAt: new Date().toISOString(),
        signedDate: form.signedDate || fmt(new Date())
      };
      const filename = `contract_${fmt(new Date())}_${form.shopName.replace(/\s/g, '')}.json`;

      const res = await fetch('/api/sendContract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contractData: payload, filename, pin: ENGINEER_PIN })
      });

      if (res.ok) {
        setForm(initialFormState);
        setSigPadKey(prev => prev + 1);
        window.history.replaceState(null, '', window.location.pathname);
        setViewState('success');
      } else {
        const data = await res.json();
        showToast(`전송 실패: ${data.message || '오류'}`, 'error');
      }
    } catch (err) {
      console.error(err);
      showToast("네트워크 오류 발생", 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- SUBMIT: Owner (Save to LocalStorage) ---
  const handleOwnerSaveContract = async () => {
     const errors = validateForm();
     if (errors.length > 0) {
       // Make error message very visible
       showToast(`[저장 실패] 필수 입력 누락: ${errors.join(", ")}`, 'error');
       return;
     }

     if (!confirm("계약서를 저장하시겠습니까?")) return;

     setIsSubmitting(true); // Show loading state on button

     // Add artificial delay for UX (visual feedback)
     await new Promise(resolve => setTimeout(resolve, 600));

     const now = new Date().toISOString();
     const contractId = form.id || uid();
     
     // Check if updating existing
     const existing = contracts.find(c => c.id === contractId);

     const newContract: Contract = {
        ...form,
        id: contractId,
        version: existing ? (existing.version + 1) : 1,
        createdAt: existing ? existing.createdAt : now,
        updatedAt: now,
        status: form.status || 'active',
        scheduleMeta: form.scheduleMeta!,
        signedDate: form.signedDate || fmt(new Date())
     };

     setContracts(prev => {
        const index = prev.findIndex(c => c.id === contractId);
        let next;
        if (index >= 0) {
             // Update existing
             next = [...prev];
             next[index] = newContract;
             showToast("계약서가 수정되었습니다.");
        } else {
             // Append new
             next = [newContract, ...prev];
             showToast("목록에 저장되었습니다.");
        }
        localStorage.setItem("itscare_contracts_v1", JSON.stringify(next));
        return next;
     });

     setViewState('owner_dashboard');
     setForm(initialFormState);
     setSigPadKey(prev => prev + 1);
     setIsSubmitting(false);
  };


  // --- Sub-components ---
  const Header = () => (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 lg:px-6 fixed top-0 w-full z-50 shadow-sm print:hidden">
      <div className="flex items-center gap-4 lg:gap-6">
        <div className="flex items-center gap-2" onClick={() => role === 'owner' && setViewState('owner_dashboard')}>
           <div className="bg-emerald-600 text-white p-1.5 rounded-lg">
             <FileText size={20} />
           </div>
           <span className="font-bold text-lg text-gray-800 tracking-tight hidden md:block">위생관리 계약 매니저</span>
           <span className="font-bold text-lg text-gray-800 tracking-tight md:hidden">계약 매니저</span>
        </div>
        
        {/* Navigation for Owner */}
        {role === 'owner' && (
          <div className="flex bg-gray-100 rounded-lg p-1 ml-2">
            <button 
              onClick={() => {
                setForm(initialFormState);
                setSigPadKey(prev => prev + 1);
                setViewState('owner_editor');
              }}
              className={`px-3 py-1.5 rounded-md text-sm font-bold transition-all flex items-center gap-1 ${
                viewState === 'owner_editor' ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <PenTool size={14}/> 작성
            </button>
            <button 
               onClick={() => setViewState('owner_dashboard')}
               className={`px-3 py-1.5 rounded-md text-sm font-bold transition-all flex items-center gap-1 ${
                 viewState === 'owner_dashboard' ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
               }`}
            >
              <List size={14}/> 목록
            </button>
          </div>
        )}
      </div>

      {/* NEW: Action Buttons in Header for Desktop */}
      {(viewState === 'engineer_editor' || viewState === 'owner_editor') && (
         <div className="hidden lg:flex items-center gap-2 ml-auto mr-4">
            {/* JSON Actions for Desktop */}
            <div className="flex items-center gap-1 mr-2 border-r border-gray-200 pr-3">
                 <button 
                  onClick={() => editorFileInputRef.current?.click()} 
                  className="text-gray-500 hover:text-emerald-600 px-2 py-2 rounded-lg text-sm font-bold flex items-center gap-1 hover:bg-gray-50 transition-colors"
                >
                  <Upload size={16} /> 불러오기
                </button>
                <button 
                  onClick={() => handleSaveJson(form, 'draft')} 
                  className="text-gray-500 hover:text-emerald-600 px-2 py-2 rounded-lg text-sm font-bold flex items-center gap-1 hover:bg-gray-50 transition-colors"
                >
                  <Save size={16} /> 저장
                </button>
            </div>

            <button onClick={() => handleDownloadPdf(form)} className="bg-white border border-orange-200 text-orange-600 px-4 py-2 rounded-lg text-sm font-bold shadow-sm hover:bg-orange-50 flex items-center gap-2 transition-colors">
              <FileDown size={16} /> PDF
            </button>
            {role === 'owner' && (
              <button 
                onClick={() => handlePrint(form)}
                className="bg-white border border-gray-200 text-gray-600 px-4 py-2 rounded-lg text-sm font-bold shadow-sm hover:bg-gray-50 flex items-center gap-2 transition-colors"
              >
                <Printer size={16} /> 인쇄
              </button>
            )}
         </div>
      )}

      <div className="flex items-center gap-3">
         <span className="text-xs font-bold bg-gray-100 text-gray-500 px-2 py-1 rounded hidden md:block">
            {role === 'owner' ? '관리자 모드' : '기사 모드'}
         </span>
         <button onClick={handleLogout} className="text-gray-400 hover:text-red-500 text-sm font-medium flex items-center gap-1">
           <LogOut size={16} /> <span className="hidden md:inline">로그아웃</span>
         </button>
      </div>
    </header>
  );

  const HiddenPdfTemplate = () => (
    <div style={{ position: 'fixed', left: '-9999px', top: 0, width: '210mm', minHeight: '297mm', background: 'white', zIndex: -1 }}>
       <div id="hidden-pdf-template">
          {pdfTarget && <ContractPaper data={pdfTarget} printMode={true} />}
       </div>
    </div>
  );
  
  const PrintTemplate = () => (
    <div className="hidden print:block fixed inset-0 bg-white z-[9999]">
       {printTarget && <ContractPaper data={printTarget} printMode={true} />}
    </div>
  );

  // --- Render Views ---

  if (viewState === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  // 1. LOGIN
  if (viewState === 'login') {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-gray-200">
          <div className="flex justify-center mb-6">
            <div className="bg-emerald-100 p-4 rounded-full">
              <Lock size={32} className="text-emerald-600" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-center text-gray-800 mb-2">통합 로그인</h1>
          <p className="text-center text-gray-500 mb-6 text-sm">기사 또는 본사 PIN 번호를 입력하세요.</p>
          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-center text-lg tracking-widest"
              placeholder="PIN 번호 입력"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              autoFocus
            />
            {authError && <div className="text-red-500 text-sm text-center font-bold animate-pulse">{authError}</div>}
            <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2">
              <LogIn size={20} /> 접속하기
            </button>
          </form>
        </div>
      </div>
    );
  }

  // 2. SUCCESS (Engineer)
  if (viewState === 'success' && role === 'engineer') {
    return (
      <div className="min-h-screen bg-emerald-50 flex flex-col items-center justify-center p-6 text-center">
        <CheckCircle2 size={64} className="text-emerald-600 mb-4" />
        <h1 className="text-2xl font-bold text-gray-800 mb-2">제출 완료</h1>
        <p className="text-gray-600 mb-8">계약서가 본사로 안전하게 전송되었습니다.<br />기기에는 데이터가 남지 않습니다.</p>
        <button onClick={() => setViewState('engineer_editor')} className="px-6 py-3 bg-white border border-gray-300 rounded-xl font-bold text-gray-700 shadow-sm">
          새 계약 작성하기
        </button>
      </div>
    );
  }

  // 3. OWNER DASHBOARD (LIST VIEW)
  if (viewState === 'owner_dashboard' && role === 'owner') {
    const REGIONS = ['전체', '부산', '울산', '양산', '김해'];
    
    // Filter Logic
    const filteredContracts = contracts.filter(c => {
        const matchesRegion = regionFilter === '전체' || (c.region || '부산') === regionFilter;
        const matchesSearch = searchTerm === '' 
          || c.shopName.toLowerCase().includes(searchTerm.toLowerCase())
          || c.ownerName.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesRegion && matchesSearch;
    });

    return (
      <div className="min-h-screen bg-gray-50 pt-16 print:hidden">
        <HiddenPdfTemplate />
        <PrintTemplate />
        <Header />
        
        {toast && (
          <div className={`fixed top-20 right-4 z-50 px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 text-white animate-fade-in ${toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'}`}>
            {toast.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
            {toast.msg}
          </div>
        )}

        <div className="max-w-4xl mx-auto mt-8 px-4 pb-20">
          
          {/* Dashboard Controls */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6 shadow-sm">
             <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
                 <h2 className="text-xl font-bold text-gray-800">📂 계약서 관리</h2>
                 
                 <div className="flex flex-wrap gap-2 w-full md:w-auto">
                    <input type="file" ref={fileInputRef} onChange={handleListFileUpload} accept=".json" className="hidden" />
                    <button onClick={() => fileInputRef.current?.click()} className="flex-1 md:flex-none bg-white border border-gray-300 text-gray-700 px-3 py-2 rounded-lg text-sm font-bold flex justify-center items-center gap-1 hover:bg-gray-50 shadow-sm">
                      <Import size={16} /> 불러오기
                    </button>
                    <button onClick={() => handleSaveJson(contracts, 'ALL_BACKUP')} className="flex-1 md:flex-none bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-2 rounded-lg text-sm font-bold flex justify-center items-center gap-1 hover:bg-emerald-100 shadow-sm">
                      <Archive size={16} /> 전체 내보내기
                    </button>
                 </div>
             </div>
             
             {/* Search & Tabs */}
             <div className="flex flex-col gap-4">
                <div className="relative">
                   <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                   <input 
                     type="text" 
                     placeholder="매장명 또는 고객명 검색..." 
                     className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                     value={searchTerm}
                     onChange={(e) => setSearchTerm(e.target.value)}
                   />
                </div>
                
                <div className="flex gap-1 overflow-x-auto pb-1 no-scrollbar">
                   {REGIONS.map(r => (
                      <button 
                        key={r}
                        onClick={() => setRegionFilter(r)}
                        className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-colors border ${
                            regionFilter === r 
                            ? 'bg-gray-800 text-white border-gray-800' 
                            : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        {r}
                      </button>
                   ))}
                </div>
             </div>
          </div>

          <div className="flex justify-between items-center mb-2 px-1">
             <span className="text-sm font-bold text-gray-500">
               총 {filteredContracts.length}건
               {searchTerm && ` (검색됨)`}
             </span>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden min-h-[300px]">
             {filteredContracts.length === 0 ? (
               <div className="p-12 text-center text-gray-400 flex flex-col items-center justify-center h-full">
                  <FileText size={48} className="mb-4 text-gray-200" />
                  <p>조건에 맞는 계약서가 없습니다.</p>
                  <p className="text-sm mt-2">검색어를 확인하거나 새로운 계약서를 작성하세요.</p>
               </div>
             ) : (
               <div className="divide-y divide-gray-100">
                 {filteredContracts.map(c => (
                   <div key={c.id} className="p-5 hover:bg-gray-50 transition cursor-pointer" onClick={() => setExpandedId(prev => prev === c.id ? null : c.id)}>
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                           <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 font-bold text-xs">
                             {c.region ? c.region.slice(0,2) : '부산'}
                           </div>
                           <div>
                              <div className="flex items-center gap-2">
                                 <span className="font-bold text-gray-900 text-lg">{c.shopName}</span>
                                 <span className="text-gray-500 text-sm">({c.ownerName})</span>
                              </div>
                              <div className="text-xs text-gray-400 mt-0.5">{c.address || '주소 미입력'}</div>
                           </div>
                        </div>
                        <ChevronRight size={20} className={`text-gray-300 transition-transform ${expandedId === c.id ? 'rotate-90' : ''}`}/>
                      </div>
                      
                      {expandedId === c.id && (
                        <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600 animate-fade-in bg-gray-50/50 -mx-5 px-5 pb-2">
                           <div className="flex flex-col gap-1">
                              <span className="font-semibold text-gray-400 text-xs">연락처</span>
                              <span>{c.contactNumber}</span>
                           </div>
                           <div className="flex flex-col gap-1">
                              <span className="font-semibold text-gray-400 text-xs">계약 기간</span>
                              <span>{c.contractStart} ~ {c.contractEnd}</span>
                           </div>
                           <div className="col-span-1 md:col-span-2 flex flex-wrap justify-end gap-2 mt-2">
                              {/* Edit Button */}
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleEditContract(c); }}
                                className="bg-white border border-gray-300 text-emerald-600 px-3 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-emerald-50 transition-colors shadow-sm"
                              >
                                 <Edit size={16} /> 수정
                              </button>
                              <button 
                                onClick={(e) => { e.stopPropagation(); handlePrint(c); }}
                                className="bg-white border border-gray-300 text-gray-600 px-3 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-gray-50 transition-colors shadow-sm"
                              >
                                 <Printer size={16} /> 인쇄
                              </button>
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleSaveJson(c, 'backup'); }}
                                className="bg-white border border-gray-300 text-gray-600 px-3 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-gray-50 transition-colors shadow-sm"
                              >
                                 <FileJson size={16} /> JSON
                              </button>
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleDownloadPdf(c); }}
                                className="bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-gray-900 transition-colors shadow-sm"
                              >
                                 <FileDown size={16} /> PDF 저장
                              </button>
                           </div>
                        </div>
                      )}
                   </div>
                 ))}
               </div>
             )}
          </div>
        </div>
      </div>
    );
  }

  // 4. EDITOR VIEW (Engineer & Owner Write Mode)
  if (viewState === 'engineer_editor' || viewState === 'owner_editor') {
    return (
      <div className="pt-16 h-screen bg-gray-50 flex flex-col overflow-hidden print:hidden">
        <HiddenPdfTemplate />
        <PrintTemplate />
        <Header />

        {toast && (
          <div className={`fixed top-20 right-4 z-50 px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 text-white animate-fade-in ${toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'}`}>
            {toast.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
            {toast.msg}
          </div>
        )}

        {/* --- MOBILE TABS (Visible only on lg and below) --- */}
        <div className="lg:hidden shrink-0 flex border-b border-gray-200 bg-white z-40 relative shadow-sm">
           <button 
             onClick={() => setMobileTab('form')}
             className={`flex-1 py-2 text-sm font-bold flex justify-center items-center gap-2 transition-colors ${
                mobileTab === 'form' ? 'text-emerald-600 border-b-2 border-emerald-600' : 'text-gray-500'
             }`}
           >
             <PenTool size={16}/> 정보 입력
           </button>
           <button 
             onClick={() => setMobileTab('preview')}
             className={`flex-1 py-2 text-sm font-bold flex justify-center items-center gap-2 transition-colors ${
                mobileTab === 'preview' ? 'text-emerald-600 border-b-2 border-emerald-600' : 'text-gray-500'
             }`}
           >
             <Layout size={16}/> 계약서 미리보기
           </button>
        </div>

        {/* --- DESKTOP CENTERED WRAPPER --- */}
        <div className="flex-1 flex flex-col lg:flex-row w-full lg:max-w-[1380px] lg:mx-auto lg:shadow-2xl lg:border-x border-gray-200 bg-white overflow-hidden h-full">
            
            {/* --- LEFT SIDEBAR (FORM) --- */}
            <div className={`
                ${mobileTab === 'form' ? 'flex flex-col' : 'hidden'} 
                lg:flex lg:flex-col w-full lg:w-[400px] bg-white border-r border-gray-200 
                flex-1 lg:flex-none overflow-hidden z-10 
            `}>
               <div className="flex-1 overflow-y-auto p-4 lg:p-6 pb-32 space-y-4 custom-scrollbar">
                  
                  {/* Manager Email Info */}
                  <div className="bg-green-50 border border-green-100 rounded-lg p-3">
                     <label className="text-[11px] font-bold text-green-700 mb-1 block">최신받음 이메일 (관리자)</label>
                     <div className="bg-white border border-green-200 rounded px-2 py-1.5 text-gray-600 text-xs font-medium break-all">
                        {DEFAULT_MANAGER_EMAIL}
                     </div>
                     <p className="text-[10px] text-green-600 mt-0.5">고객이 파일 전송 시 이 주소가 자동으로 입력됩니다.</p>
                  </div>

                  {/* Form Section */}
                  <div>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-2 border-b pb-1 gap-1">
                       <h2 className="text-base font-bold text-gray-800 flex items-center gap-1">
                          <span className="text-xl">📝</span> {form.id ? '계약 수정' : '새 계약 작성'}
                       </h2>
                       
                       {/* Input is shared and always rendered but hidden */}
                       <input type="file" ref={editorFileInputRef} onChange={handleEditorFileUpload} accept=".json" className="hidden" />

                       {/* JSON Load/Save Buttons (Mobile Only) */}
                       <div className="flex gap-1 self-end sm:self-auto lg:hidden">
                          <button onClick={() => editorFileInputRef.current?.click()} className="text-[11px] px-2 py-1 bg-gray-50 hover:bg-gray-100 rounded text-gray-600 flex items-center gap-1 border border-gray-200 transition-colors" title="불러오기">
                              <Upload size={12}/> 불러오기
                          </button>
                          <button onClick={() => handleSaveJson(form, 'draft')} className="text-[11px] px-2 py-1 bg-gray-50 hover:bg-gray-100 rounded text-gray-600 flex items-center gap-1 border border-gray-200 transition-colors" title="JSON 저장">
                              <Save size={12}/> JSON 저장
                          </button>
                          <button onClick={resetForm} className="text-[11px] px-2 py-1 bg-red-50 hover:bg-red-100 rounded text-red-600 flex items-center gap-1 border border-red-100 transition-colors ml-1" title="초기화">
                              <RotateCcw size={12}/> 초기화
                          </button>
                       </div>
                       
                       {/* Desktop Reset Button (since we moved Save/Load to header) */}
                       <div className="hidden lg:block">
                           <button onClick={resetForm} className="text-[11px] px-2 py-1 bg-red-50 hover:bg-red-100 rounded text-red-600 flex items-center gap-1 border border-red-100 transition-colors" title="초기화">
                              <RotateCcw size={12}/> 초기화
                          </button>
                       </div>
                    </div>

                    <div className="space-y-2">
                       {/* Region Selection */}
                       <div className="bg-gray-50 p-2 rounded-lg border border-gray-100 mb-2">
                          <label className="text-[11px] font-bold text-gray-500 mb-1 block">지역 선택</label>
                          <div className="grid grid-cols-4 gap-1">
                             {['부산', '울산', '양산', '김해'].map(r => (
                               <button 
                                 key={r}
                                 onClick={() => handleInputChange('region', r)}
                                 className={`py-1.5 text-xs font-bold rounded border transition-all ${
                                    form.region === r 
                                    ? 'bg-gray-800 text-white border-gray-800 shadow-sm' 
                                    : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-100'
                                 }`}
                               >
                                 {r}
                               </button>
                             ))}
                          </div>
                       </div>

                       <div className="grid grid-cols-2 gap-2">
                          <input className="input-field" placeholder="매장명" value={form.shopName} onChange={(e) => handleInputChange('shopName', e.target.value)} />
                          <input className="input-field" placeholder="대표자명" value={form.ownerName} onChange={(e) => handleInputChange('ownerName', e.target.value)} />
                       </div>
                       <input className="input-field" placeholder="연락처 (010-0000-0000)" value={form.contactNumber} onChange={(e) => handleInputChange('contactNumber', e.target.value)} />
                       <input className="input-field" placeholder="영업장 주소" value={form.address} onChange={(e) => handleInputChange('address', e.target.value)} />
                       
                       <div className="grid grid-cols-3 gap-2">
                          <input className="input-field" placeholder="기종" value={form.model} onChange={(e) => handleInputChange('model', e.target.value)} />
                          <div className="relative">
                             <input className="input-field pr-6" placeholder="용량" value={form.capacity} onChange={(e) => handleInputChange('capacity', e.target.value)} />
                             <span className="absolute right-2 top-2 text-[10px] text-gray-400">kg</span>
                          </div>
                          <input type="number" className="input-field" placeholder="대수" value={form.quantity} onChange={(e) => handleInputChange('quantity', Number(e.target.value))} />
                       </div>

                       <div className="border-t border-gray-100 my-1"></div>

                       <div className="grid grid-cols-2 gap-2 bg-gray-50 p-2 rounded-lg border border-gray-100">
                          <div>
                            <label className="text-[11px] font-bold text-gray-500 mb-0.5 block">관리 주기</label>
                            <select className="input-field bg-white py-1" value={form.cycleMonths} onChange={(e) => handleInputChange('cycleMonths', Number(e.target.value))}>
                              <option value={1}>1개월</option><option value={2}>2개월</option><option value={3}>3개월</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-[11px] font-bold text-gray-500 mb-0.5 block">첫 청소일</label>
                            <input type="date" className="input-field bg-white py-1" value={form.firstDate} onChange={(e) => handleInputChange('firstDate', e.target.value)} />
                          </div>
                          <div>
                            <label className="text-[11px] font-bold text-gray-500 mb-0.5 block">계약 시작일</label>
                            <input type="date" className="input-field bg-white py-1" value={form.contractStart} onChange={(e) => handleInputChange('contractStart', e.target.value)} />
                          </div>
                          <div>
                            <label className="text-[11px] font-bold text-gray-500 mb-0.5 block">계약 종료일</label>
                            <input type="date" className="input-field bg-white py-1" value={form.contractEnd} onChange={(e) => handleInputChange('contractEnd', e.target.value)} />
                          </div>
                       </div>

                       <div className="flex gap-2">
                          <button onClick={calcAutoSchedule} className="flex-1 bg-blue-50 text-blue-600 hover:bg-blue-100 py-2 rounded-lg text-xs font-bold transition-colors flex justify-center items-center gap-1 border border-blue-100">
                             🗓️ 일정 산정
                          </button>
                          <button onClick={fillToday} className="flex-1 bg-gray-100 text-gray-600 hover:bg-gray-200 py-2 rounded-lg text-xs font-bold transition-colors border border-gray-200">
                             오늘 기준 채우기
                          </button>
                       </div>
                       
                       <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[11px] font-bold text-gray-500 mb-0.5 block">관리비</label>
                            <input type="text" className="input-field" placeholder="금액 입력" value={form.price ? form.price.toLocaleString() : ''} onChange={(e) => { const val = e.target.value.replace(/[^0-9]/g, ''); handleInputChange('price', val ? Number(val) : null); }} />
                          </div>
                          <div>
                            <label className="text-[11px] font-bold text-gray-500 mb-0.5 block">부가세</label>
                            <select className="input-field py-1" value={form.vat} onChange={(e) => handleInputChange('vat', e.target.value)}>
                              <option>VAT 포함</option><option>VAT 별도</option>
                            </select>
                          </div>
                       </div>
                    </div>
                  </div>

                  {/* Signature Section */}
                  <div className="bg-orange-50/50 p-3 rounded-xl border border-orange-100 mt-2">
                      <h2 className="text-base font-bold text-gray-800 flex items-center gap-2 mb-2">
                          <span className="text-xl">✍️</span> 서명 및 완료
                      </h2>
                      
                      <div className="space-y-1 mb-2">
                        <label className="flex items-center gap-2 text-xs cursor-pointer p-1.5 hover:bg-white rounded transition-colors">
                          <input type="checkbox" className="w-3.5 h-3.5 text-orange-500 rounded focus:ring-orange-500" checked={form.agree.read} onChange={() => handleAgreeChange('read')} />
                          <span className="font-medium text-gray-700">계약 내용 확인 동의</span>
                        </label>
                        <label className="flex items-center gap-2 text-xs cursor-pointer p-1.5 hover:bg-white rounded transition-colors">
                          <input type="checkbox" className="w-3.5 h-3.5 text-orange-500 rounded focus:ring-orange-500" checked={form.agree.schedule} onChange={() => handleAgreeChange('schedule')} />
                          <span className="font-medium text-gray-700">일정 산정 동의</span>
                        </label>
                      </div>

                      <SignaturePad key={sigPadKey} value={form.signatureDataUrl} onChange={(val) => handleInputChange('signatureDataUrl', val)} />
                  </div>
                  
                  {/* Main Action Buttons */}
                  {role === 'engineer' ? (
                    <button 
                      onClick={handleSubmitContract} 
                      disabled={isSubmitting}
                      className="w-full bg-gray-900 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-black transition-all flex justify-center items-center gap-2 disabled:bg-gray-400 mt-2"
                    >
                       {isSubmitting ? '전송 중...' : '저장 (본사 제출)'}
                    </button>
                  ) : (
                    <button 
                      onClick={handleOwnerSaveContract} 
                      disabled={isSubmitting}
                      className={`w-full py-3 rounded-xl font-bold shadow-lg transition-all flex justify-center items-center gap-2 mt-2 ${
                         isSubmitting ? 'bg-emerald-800 text-gray-200' : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      }`}
                    >
                       {isSubmitting ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            저장 중...
                          </>
                       ) : (
                          <>
                            <Save size={18} /> {form.id ? '수정 저장 (목록 업데이트)' : '저장 (목록에 추가)'}
                          </>
                       )}
                    </button>
                  )}
               </div>
            </div>

            {/* --- RIGHT CONTENT (PREVIEW) --- */}
            <div className={`
                ${mobileTab === 'preview' ? 'flex flex-col' : 'hidden'}
                lg:flex lg:flex-col flex-1 bg-gray-100/50 lg:bg-gray-100 relative overflow-hidden
            `}>
               <div className="flex-1 overflow-y-auto p-4 lg:p-6 custom-scrollbar">
                   <div className="max-w-[210mm] mx-auto pb-20 lg:pb-0">
                      
                      {/* Local Header: Visible on Mobile Only */}
                      <div className="flex justify-between items-center mb-4 lg:hidden">
                          <h2 className="text-lg font-bold text-gray-700 flex items-center gap-2"><FileText size={20}/> 미리보기</h2>
                          <div className="flex gap-2">
                              <button onClick={() => handleDownloadPdf(form)} className="bg-white border border-orange-200 text-orange-600 px-4 py-2 rounded-lg text-sm font-bold shadow-sm hover:bg-orange-50 flex items-center gap-2 transition-colors">
                                <FileDown size={16} /> PDF
                              </button>
                              {role === 'owner' && (
                                <button 
                                  onClick={() => handlePrint(form)}
                                  className="bg-white border border-gray-200 text-gray-600 px-4 py-2 rounded-lg text-sm font-bold shadow-sm hover:bg-gray-50 flex items-center gap-2 transition-colors"
                                >
                                  <Printer size={16} /> 인쇄
                                </button>
                              )}
                          </div>
                      </div>
                      
                      <div ref={printRef} className="shadow-2xl transition-transform duration-300 origin-top">
                          <ContractPaper data={form} />
                      </div>

                      {/* Mobile Hint */}
                      <div className="lg:hidden mt-4 text-center text-gray-400 text-sm">
                        화면을 좌우로 스크롤하여 전체 내용을 확인하세요.
                      </div>
                   </div>
               </div>
            </div>

        </div>

        <style>{`
          .input-field {
            width: 100%;
            padding: 8px 10px;
            background: #fff;
            border: 1px solid #e5e7eb;
            border-radius: 6px;
            font-size: 13px;
            color: #374151;
            outline: none;
            transition: all 0.2s;
          }
          .input-field:focus {
            border-color: #3b82f6;
            box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
          }
          .custom-scrollbar::-webkit-scrollbar {
            width: 8px;
            height: 8px;
          }
          .custom-scrollbar::-webkit-scrollbar-track {
            background: transparent;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb {
            background-color: #cbd5e1;
            border-radius: 4px;
          }
          .no-scrollbar::-webkit-scrollbar {
            display: none;
          }
          .no-scrollbar {
            -ms-overflow-style: none;
            scrollbar-width: none;
          }
        `}</style>
      </div>
    );
  }

  return <div className="min-h-screen bg-gray-100 flex items-center justify-center">Loading...</div>;
}

export default App;
