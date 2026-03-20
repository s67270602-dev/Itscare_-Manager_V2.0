
import React, { useState, useRef, useEffect } from 'react';
import {
  CheckCircle2, AlertCircle, User, Lock, LogIn, Import, PenTool, Send, LogOut, FileDown,
  RotateCcw, FileText, List, Printer, Save, Upload, FileJson, ChevronRight, Layout, Edit, Search, Archive,
  Trash2, PauseCircle, CalendarPlus
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { Contract, ContractFormState, ContractStatus } from './types';
import { uid, addMonthsSafe, fmt, calculateSchedule } from './utils';
import SignaturePad from './components/SignaturePad';
import ContractPaper from './components/ContractPaper';

const DEFAULT_MANAGER_EMAIL = "itscare.clean@gmail.com";

// ✅ 구글 앱스 스크립트 배포 URL
const GOOGLE_SHEET_URL = "https://script.google.com/macros/s/AKfycbzRkI0zGX_kYHedXvIAo0GW471sd1YbJav9MrwCdSw1h9hOmXZMSeSkOWDQgo7Pe2hM/exec"; 

const OWNER_PIN = "20094316";
const ENGINEER_PIN = "15777672";

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
  region: '부산',
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

// --- CSV Helper Functions ---
const escapeCsv = (val: any) => {
  if (val === null || val === undefined) return '';
  let strVal = typeof val === 'object' ? JSON.stringify(val) : String(val);
  if (strVal.includes(',') || strVal.includes('"') || strVal.includes('\n')) {
    return `"${strVal.replace(/"/g, '""')}"`;
  }
  return strVal;
};

const jsonToCsv = (data: any[]) => {
  if (!data || data.length === 0) return '';
  const keys = Object.keys(data[0]);
  const header = keys.join(',');
  const rows = data.map(row => keys.map(k => escapeCsv(row[k])).join(','));
  return [header, ...rows].join('\n');
};

const csvToJson = (csv: string) => {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;

  for (let i = 0; i < csv.length; i++) {
    const char = csv[i];
    const nextChar = csv[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentCell += '"';
        i++; 
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      currentRow.push(currentCell);
      currentCell = '';
    } else if ((char === '\n' || (char === '\r' && nextChar === '\n')) && !inQuotes) {
      if (char === '\r') i++;
      currentRow.push(currentCell);
      rows.push(currentRow);
      currentRow = [];
      currentCell = '';
    } else {
      currentCell += char;
    }
  }
  if (currentCell !== '' || currentRow.length > 0) {
    currentRow.push(currentCell);
    rows.push(currentRow);
  }

  if (rows.length < 2) return [];

  const headers = rows[0];
  const result = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length === 1 && row[0].trim() === '') continue;
    const obj: any = {};
    headers.forEach((header, index) => {
      let val: any = row[index];
      if (val !== undefined) {
        try {
          if (val === 'true') val = true;
          else if (val === 'false') val = false;
          else if (val === 'null' || val === '') val = null;
          else if ((val.startsWith('{') && val.endsWith('}')) || (val.startsWith('[') && val.endsWith(']'))) {
            val = JSON.parse(val);
          } else if (!isNaN(Number(val)) && val.trim() !== '' && !val.startsWith('0')) {
            val = Number(val);
          }
        } catch (e) { }
        obj[header] = val;
      }
    });
    result.push(obj);
  }
  return result;
};

// 🌟 강력한 구글 시트 전송 헬퍼 함수
const sendToGoogleSheet = async (dataPayload: any) => {
    // 객체를 폼 데이터(URL-encoded) 형식으로 변환하여 차단을 방지합니다.
    const formData = new URLSearchParams();
    Object.keys(dataPayload).forEach(key => {
        let val = dataPayload[key];
        if (typeof val === 'object' && val !== null) {
            val = JSON.stringify(val);
        }
        formData.append(key, val === null || val === undefined ? '' : String(val));
    });

    try {
        await fetch(GOOGLE_SHEET_URL, {
            method: 'POST',
            mode: 'no-cors', // CORS 정책 완전 우회
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: formData.toString()
        });
        return true;
    } catch (e) {
        console.error("구글 전송 에러:", e);
        return false;
    }
};

function App() {
  const [role, setRole] = useState<UserRole>(null);
  const [viewState, setViewState] = useState<ViewState>('login');
  const [pinInput, setPinInput] = useState('');
  const [authError, setAuthError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [mobileTab, setMobileTab] = useState<'form' | 'preview'>('form');

  const [contracts, setContracts] = useState<Contract[]>([]);
  const [form, setForm] = useState<ContractFormState>(initialFormState);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [regionFilter, setRegionFilter] = useState('전체'); 
  
  const [pdfTarget, setPdfTarget] = useState<ContractFormState | null>(null);
  const [printTarget, setPrintTarget] = useState<ContractFormState | null>(null);

  const [sigPadKey, setSigPadKey] = useState(0);
  const [toast, setToast] = useState<{ msg: string, type: 'success' | 'error' } | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null); 
  const editorFileInputRef = useRef<HTMLInputElement>(null); 
  const printRef = useRef<HTMLDivElement>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

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

  const handleSaveCsv = (data: any, prefix: string) => {
    try {
        const dataArray = Array.isArray(data) ? data : [data];
        const csvString = jsonToCsv(dataArray);
        const BOM = "\uFEFF";
        const blob = new Blob([BOM + csvString], { type: "text/csv;charset=utf-8;" });
        
        const fileName = `${prefix}_${fmt(new Date())}.csv`;
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast("CSV 파일로 저장되었습니다.");
    } catch (e) {
        console.error(e);
        showToast("저장 중 오류가 발생했습니다.", 'error');
    }
  };

  const handleDownloadPdf = async (targetData: ContractFormState) => {
    setPdfTarget(targetData);
    showToast("PDF 생성 중... (잠시만 기다려주세요)", 'success');
    
    await new Promise(resolve => setTimeout(resolve, 800));

    const source = document.getElementById('hidden-pdf-template');
    if (!source) {
      showToast("PDF 템플릿 오류", 'error');
      setPdfTarget(null);
      return;
    }

    const rootContent = source.firstElementChild as HTMLElement; 
    if (!rootContent) return;

    const titleBlock = rootContent.children[0] as HTMLElement;
    const sectionContainer = rootContent.children[1] as HTMLElement;
    
    if (!titleBlock || !sectionContainer) {
        console.error("DOM structure mismatch");
        setPdfTarget(null);
        return;
    }

    const sections = Array.from(sectionContainer.children) as HTMLElement[];

    const stagingId = "pdf-smart-staging";
    let staging = document.getElementById(stagingId);
    if (staging) staging.remove();
    
    staging = document.createElement("div");
    staging.id = stagingId;
    staging.style.position = "absolute";
    staging.style.left = "-9999px";
    staging.style.top = "0";
    document.body.appendChild(staging);

    const PAGE_WIDTH = 794; 
    const PAGE_HEIGHT = 1123;
    const PADDING = 48; 
    const CONTENT_WIDTH = PAGE_WIDTH; 
    const SAFE_HEIGHT = PAGE_HEIGHT - (PADDING * 2);

    const createNewPage = () => {
        const page = document.createElement("div");
        Object.assign(page.style, {
            width: `${PAGE_WIDTH}px`,
            minHeight: `${PAGE_HEIGHT}px`,
            backgroundColor: "white",
            padding: `${PADDING}px`,
            boxSizing: "border-box",
            position: "relative",
        });
        page.className = "text-sm leading-relaxed text-gray-800 font-sans";
        return page;
    };

    const pages: HTMLElement[] = [];
    let currentPage = createNewPage();
    let currentContentHeight = 0;
    
    pages.push(currentPage);
    staging.appendChild(currentPage);

    const appendBlock = (element: HTMLElement, marginBottom = 0) => {
        const clone = element.cloneNode(true) as HTMLElement;
        clone.style.marginBottom = `${marginBottom}px`;
        
        currentPage.appendChild(clone);
        const blockHeight = clone.offsetHeight + marginBottom;
        
        if (currentContentHeight + blockHeight > SAFE_HEIGHT) {
            currentPage.removeChild(clone);
            
            currentPage = createNewPage();
            pages.push(currentPage);
            staging.appendChild(currentPage);
            
            currentContentHeight = 0;
            currentPage.appendChild(clone);
            currentContentHeight += blockHeight;
        } else {
            currentContentHeight += blockHeight;
        }
    };

    appendBlock(titleBlock, 32); 

    sections.forEach((sec, idx) => {
        const isLast = idx === sections.length - 1;
        appendBlock(sec, isLast ? 0 : 32);
    });

    try {
        const pdf = new jsPDF('p', 'mm', 'a4');
        
        for (let i = 0; i < pages.length; i++) {
            if (i > 0) pdf.addPage();
            
            const canvas = await html2canvas(pages[i], {
                scale: 2, 
                logging: false,
                useCORS: true
            });
            
            const imgData = canvas.toDataURL('image/png');
            pdf.addImage(imgData, 'PNG', 0, 0, 210, 297);
        }

        pdf.save(`contract_${targetData.shopName || 'document'}.pdf`);
        showToast("PDF 다운로드 완료");

    } catch (err) {
        console.error("PDF generation error", err);
        showToast("PDF 생성 실패", 'error');
    } finally {
        if (staging) staging.remove();
        setPdfTarget(null);
    }
  };

  const handlePrint = (targetData: ContractFormState) => {
    setPrintTarget(targetData);
  };

  useEffect(() => {
    if (printTarget) {
      const timer = setTimeout(() => {
        window.print();
        setPrintTarget(null);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [printTarget]);

  const handleListFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const csvData = event.target?.result as string;
        const parsedData = csvToJson(csvData);
        
        if (!parsedData || parsedData.length === 0) throw new Error("데이터가 없습니다.");

        setContracts(prev => {
            const currentIds = new Set(prev.map(c => c.id));
            const merged = [...prev];
            let addedCount = 0;

            parsedData.forEach((item: any) => {
                if (!item.shopName) return;
                if (!item.id) item.id = uid();
                
                if (!currentIds.has(item.id)) {
                    merged.push({
                        ...item,
                        region: item.region || '부산',
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
    reader.readAsText(file, "utf-8");
  };

  const handleEditorFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const csvData = event.target?.result as string;
        const parsedData = csvToJson(csvData);
        
        if (!parsedData || parsedData.length === 0) throw new Error("빈 데이터입니다.");

        const data = parsedData[0];
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
        showToast("올바른 CSV 파일이 아닙니다.", 'error');
      }
      if (editorFileInputRef.current) editorFileInputRef.current.value = '';
    };
    reader.readAsText(file, "utf-8");
  };

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

  const handleEditContract = (c: Contract) => {
    if (!confirm(`[${c.shopName}] 계약서를 수정하시겠습니까?\n작성 화면으로 이동합니다.`)) return;
    
    const newFormState = {
        ...initialFormState,
        ...c,
        agree: { ...initialFormState.agree, ...c.agree }
    };
    
    setForm(newFormState);
    setSigPadKey(prev => prev + 1); 
    setViewState('owner_editor');
  };

  const handleDeleteContract = (id: string) => {
    if(!confirm("정말로 이 계약서를 삭제하시겠습니까?\n삭제된 데이터는 복구할 수 없습니다.")) return;
    
    setContracts(prev => {
        const next = prev.filter(c => c.id !== id);
        localStorage.setItem("itscare_contracts_v1", JSON.stringify(next));
        return next;
    });
    showToast("삭제되었습니다.");
  };

  const handleSuspendContract = (id: string, currentStatus: ContractStatus) => {
    const newStatus: ContractStatus = currentStatus === 'suspended' ? 'active' : 'suspended';
    const actionName = newStatus === 'suspended' ? '중지' : '활성화';

    if(!confirm(`이 계약을 [${actionName}] 상태로 변경하시겠습니까?`)) return;

    setContracts(prev => {
        const next = prev.map(c => c.id === id ? { ...c, status: newStatus, updatedAt: new Date().toISOString() } : c);
        localStorage.setItem("itscare_contracts_v1", JSON.stringify(next));
        return next;
    });
    showToast(`계약이 ${actionName}되었습니다.`);
  };

  const handleExtendContract = (c: Contract) => {
    if(!confirm(`[${c.shopName}] 계약을 연장하시겠습니까?\n기존 종료일 기준으로 1년 연장된 새 계약서를 작성합니다.`)) return;

    const oldEnd = new Date(c.contractEnd);
    const newStart = addMonthsSafe(oldEnd, 0); 
    newStart.setDate(newStart.getDate() + 1); 
    
    const newEnd = addMonthsSafe(newStart, 12); 

    const newFormState: ContractFormState = {
        ...initialFormState,
        ...c, 
        id: null, 
        status: 'active',
        contractStart: fmt(newStart),
        contractEnd: fmt(newEnd),
        firstDate: fmt(newStart),
        signedDate: '', 
        signatureDataUrl: null, 
        agree: initialFormState.agree 
    };

    setForm(newFormState);
    setSigPadKey(prev => prev + 1);
    setViewState('owner_editor');
    showToast("계약 연장 모드: 날짜를 확인하고 저장하세요.");
  };

  // --- SUBMIT: Engineer ---
  const handleSubmitContract = async () => {
    const errors = validateForm();
    if (errors.length > 0) {
      showToast(`[전송 불가] 확인 필요: ${errors.join(", ")}`, 'error');
      return;
    }

    if (!confirm("작성한 계약서를 본사(구글 시트)로 제출하시겠습니까?\n제출 후에는 기기에서 데이터가 즉시 삭제됩니다.")) return;

    setIsSubmitting(true);

    try {
      const now = new Date().toISOString();
      const payload: Contract = {
        ...form,
        id: form.id || uid(),
        version: 1,
        createdAt: now,
        updatedAt: now,
        status: form.status || 'active',
        scheduleMeta: form.scheduleMeta!,
        signedDate: form.signedDate || fmt(new Date()),
      } as any;

      // 구글 전송 헬퍼 함수 호출
      await sendToGoogleSheet(payload);

      setForm(initialFormState);
      setSigPadKey(prev => prev + 1);
      window.history.replaceState(null, '', window.location.pathname);
      setViewState('success');
      
    } catch (err) {
      console.error(err);
      showToast("네트워크 오류가 발생했습니다.", 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- SUBMIT: Owner ---
  const handleOwnerSaveContract = async () => {
     const errors = validateForm();
     if (errors.length > 0) {
       showToast(`[저장 실패] 필수 입력 누락: ${errors.join(", ")}`, 'error');
       return;
     }

     if (!confirm("계약서를 저장하시겠습니까? (구글 시트 자동 전송 포함)")) return;

     setIsSubmitting(true);

     // 동기화 느낌을 주는 UI 지연
     await new Promise(resolve => setTimeout(resolve, 800));

     const now = new Date().toISOString();
     const contractId = form.id || uid();
     
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

     // 🌟 구글 시트 데이터 꽂아넣기 
     await sendToGoogleSheet(newContract);

     setContracts(prev => {
        const index = prev.findIndex(c => c.id === contractId);
        let next;
        if (index >= 0) {
             next = [...prev];
             next[index] = newContract;
        } else {
             next = [newContract, ...prev];
        }
        localStorage.setItem("itscare_contracts_v1", JSON.stringify(next));
        return next;
     });

     showToast("데이터 동기화 및 저장 완료!");
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
           <span className="font-bold text-lg text-gray-800 tracking-tight hidden md:block">잇츠케어 전자계약서</span>
           <span className="font-bold text-lg text-gray-800 tracking-tight md:hidden">전자계약서</span>
        </div>
        
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
            <button 
               onClick={() => window.print()}
               className="px-3 py-1.5 rounded-md text-sm font-bold transition-all flex items-center gap-1 text-gray-500 hover:text-gray-700"
               title="화면 인쇄"
            >
              <Printer size={14}/> 인쇄
            </button>
          </div>
        )}
      </div>

      {(viewState === 'engineer_editor' || viewState === 'owner_editor') && (
         <div className="hidden lg:flex items-center gap-2 ml-auto mr-4">
            <div className="flex items-center gap-1 mr-2 border-r border-gray-200 pr-3">
                 <button 
                  onClick={() => editorFileInputRef.current?.click()} 
                  className="text-gray-500 hover:text-emerald-600 px-2 py-2 rounded-lg text-sm font-bold flex items-center gap-1 hover:bg-gray-50 transition-colors"
                >
                  <Upload size={16} /> 불러오기
                </button>
                <button 
                  onClick={() => handleSaveCsv(form, 'draft')} 
                  className="text-gray-500 hover:text-emerald-600 px-2 py-2 rounded-lg text-sm font-bold flex items-center gap-1 hover:bg-gray-50 transition-colors"
                >
                  <Save size={16} /> 저장
                </button>
            </div>

            <button onClick={() => handleDownloadPdf(form)} className="bg-white border border-orange-200 text-orange-600 px-4 py-2 rounded-lg text-sm font-bold shadow-sm hover:bg-orange-50 flex items-center gap-2 transition-colors">
              <FileDown size={16} /> PDF
            </button>
            {role !== 'owner' && (
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
    <div style={{ 
      position: 'absolute', 
      left: '-9999px', 
      top: 0, 
      width: '210mm',
      zIndex: -50 
    }}>
       <div id="hidden-pdf-template" className="bg-white">
          {pdfTarget && <ContractPaper data={pdfTarget} printMode={true} />}
       </div>
    </div>
  );
  
  const PrintTemplate = () => (
    <div className="hidden print:block fixed inset-0 bg-white z-[9999]">
       {printTarget && <ContractPaper data={printTarget} printMode={true} />}
    </div>
  );

  if (viewState === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

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

  if (viewState === 'success' && role === 'engineer') {
    return (
      <div className="min-h-screen bg-emerald-50 flex flex-col items-center justify-center p-6 text-center">
        <CheckCircle2 size={64} className="text-emerald-600 mb-4" />
        <h1 className="text-2xl font-bold text-gray-800 mb-2">제출 완료</h1>
        <p className="text-gray-600 mb-8">계약서가 본사 구글 시트로 안전하게 전송되었습니다.<br />기기에는 데이터가 남지 않습니다.</p>
        <button onClick={() => setViewState('engineer_editor')} className="px-6 py-3 bg-white border border-gray-300 rounded-xl font-bold text-gray-700 shadow-sm">
          새 계약 작성하기
        </button>
      </div>
    );
  }

  if (viewState === 'owner_dashboard' && role === 'owner') {
    const REGIONS = ['전체', '부산', '울산', '양산', '김해'];
    
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
          
          <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6 shadow-sm">
             <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
                 <h2 className="text-xl font-bold text-gray-800">📂 계약서 관리</h2>
                 
                 <div className="flex flex-wrap gap-2 w-full md:w-auto">
                    <input type="file" ref={fileInputRef} onChange={handleListFileUpload} accept=".csv" className="hidden" />
                    <button onClick={() => fileInputRef.current?.click()} className="flex-1 md:flex-none bg-white border border-gray-300 text-gray-700 px-3 py-2 rounded-lg text-sm font-bold flex justify-center items-center gap-1 hover:bg-gray-50 shadow-sm">
                      <Import size={16} /> 불러오기
                    </button>
                    <button onClick={() => handleSaveCsv(contracts, 'ALL_BACKUP')} className="flex-1 md:flex-none bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-2 rounded-lg text-sm font-bold flex justify-center items-center gap-1 hover:bg-emerald-100 shadow-sm">
                      <Archive size={16} /> 전체 내보내기
                    </button>
                 </div>
             </div>
             
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
                           <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs ${c.status === 'suspended' ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500'}`}>
                             {c.region ? c.region.slice(0,2) : '부산'}
                           </div>
                           <div>
                              <div className="flex items-center gap-2">
                                 <span className={`font-bold text-lg ${c.status === 'suspended' ? 'text-red-500 line-through' : 'text-gray-900'}`}>{c.shopName}</span>
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
                              {c.status === 'suspended' && <span className="text-red-500 font-bold text-xs">(계약 중지됨)</span>}
                           </div>
                           <div className="col-span-1 md:col-span-2 flex flex-wrap justify-end gap-2 mt-2 border-t border-gray-200 pt-3">
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleDeleteContract(c.id); }}
                                className="bg-white border border-red-200 text-red-500 px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-red-50 transition-colors shadow-sm"
                              >
                                 <Trash2 size={14} /> 삭제
                              </button>
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleSuspendContract(c.id, c.status); }}
                                className={`bg-white border px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors shadow-sm ${
                                  c.status === 'suspended' 
                                  ? 'border-blue-200 text-blue-600 hover:bg-blue-50' 
                                  : 'border-orange-200 text-orange-600 hover:bg-orange-50'
                                }`}
                              >
                                 <PauseCircle size={14} /> {c.status === 'suspended' ? '중지 해제' : '계약 중지'}
                              </button>
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleExtendContract(c); }}
                                className="bg-white border border-blue-200 text-blue-600 px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-blue-50 transition-colors shadow-sm"
                              >
                                 <CalendarPlus size={14} /> 계약 연장
                              </button>
                              
                              <div className="w-px h-6 bg-gray-300 mx-1"></div>

                              <button 
                                onClick={(e) => { e.stopPropagation(); handleEditContract(c); }}
                                className="bg-white border border-gray-300 text-emerald-600 px-3 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-emerald-50 transition-colors shadow-sm"
                              >
                                 <Edit size={16} /> 수정
                              </button>
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleSaveCsv(c, 'backup'); }}
                                className="bg-white border border-gray-300 text-gray-600 px-3 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-gray-50 transition-colors shadow-sm"
                              >
                                 <FileJson size={16} /> CSV
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

        <div className="flex-1 flex flex-col lg:flex-row w-full lg:max-w-[1380px] lg:mx-auto lg:shadow-2xl lg:border-x border-gray-200 bg-white overflow-hidden h-full">
           
            <div className={`
                ${mobileTab === 'form' ? 'flex flex-col' : 'hidden'} 
                lg:flex lg:flex-col w-full lg:w-[400px] bg-white border-r border-gray-200 
                flex-1 lg:flex-none overflow-hidden z-10 
            `}>
               <div className="flex-1 overflow-y-auto p-4 lg:p-6 pb-32 space-y-4 custom-scrollbar">
                 
                 <div className="bg-green-50 border border-green-100 rounded-lg p-3">
                     <label className="text-[11px] font-bold text-green-700 mb-1 block">최신받음 이메일 (관리자)</label>
                     <div className="bg-white border border-green-200 rounded px-2 py-1.5 text-gray-600 text-xs font-medium break-all">
                        {DEFAULT_MANAGER_EMAIL}
                     </div>
                     <p className="text-[10px] text-green-600 mt-0.5">고객이 파일 전송 시 이 주소가 자동으로 입력됩니다.</p>
                 </div>

                 <div>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-2 border-b pb-1 gap-1">
                       <h2 className="text-base font-bold text-gray-800 flex items-center gap-1">
                          <span className="text-xl">📝</span> {form.id ? '계약 수정' : '새 계약 작성'}
                       </h2>
                       
                       <input type="file" ref={editorFileInputRef} onChange={handleEditorFileUpload} accept=".csv" className="hidden" />

                       <div className="flex gap-1 self-end sm:self-auto lg:hidden">
                          <button onClick={() => editorFileInputRef.current?.click()} className="text-[11px] px-2 py-1 bg-gray-50 hover:bg-gray-100 rounded text-gray-600 flex items-center gap-1 border border-gray-200 transition-colors" title="불러오기">
                              <Upload size={12}/> 불러오기
                          </button>
                          <button onClick={() => handleSaveCsv(form, 'draft')} className="text-[11px] px-2 py-1 bg-gray-50 hover:bg-gray-100 rounded text-gray-600 flex items-center gap-1 border border-gray-200 transition-colors" title="CSV 저장">
                              <Save size={12}/> CSV 저장
                          </button>
                          <button onClick={resetForm} className="text-[11px] px-2 py-1 bg-red-50 hover:bg-red-100 rounded text-red-600 flex items-center gap-1 border border-red-100 transition-colors ml-1" title="초기화">
                              <RotateCcw size={12}/> 초기화
                          </button>
                       </div>
                       
                       <div className="hidden lg:block">
                           <button onClick={resetForm} className="text-[11px] px-2 py-1 bg-red-50 hover:bg-red-100 rounded text-red-600 flex items-center gap-1 border border-red-100 transition-colors" title="초기화">
                              <RotateCcw size={12}/> 초기화
                          </button>
                       </div>
                    </div>

                    <div className="space-y-2">
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
                 
                 {role === 'engineer' ? (
                    <button 
                      onClick={handleSubmitContract} 
                      disabled={isSubmitting}
                      className="w-full bg-gray-900 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-black transition-all flex justify-center items-center gap-2 disabled:bg-gray-400 mt-2"
                    >
                       {isSubmitting ? '데이터 동기화 중...' : '저장 (본사 시트 제출)'}
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
                            데이터 동기화 중...
                          </>
                       ) : (
                          <>
                            <Save size={18} /> {form.id ? '수정 저장 (시트 동기화)' : '저장 (시트에 추가)'}
                          </>
                       )}
                    </button>
                 )}
               </div>
            </div>

            <div className={`
                ${mobileTab === 'preview' ? 'flex flex-col' : 'hidden'}
                lg:flex lg:flex-col flex-1 bg-gray-100/50 lg:bg-gray-100 relative overflow-hidden
            `}>
               <div className="flex-1 overflow-y-auto p-4 lg:p-6 custom-scrollbar">
                   <div className="max-w-[210mm] mx-auto pb-20 lg:pb-0">
                      
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
