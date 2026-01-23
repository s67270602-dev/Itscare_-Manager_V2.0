
import React from 'react';
import { ContractFormState } from '../types';
import { formatCurrency } from '../utils';

interface ContractPaperProps {
  data: ContractFormState;
  printMode?: boolean;
}

const ContractPaper: React.FC<ContractPaperProps> = ({ data, printMode = false }) => {
  const {
    shopName, ownerName, contactNumber, address, model, capacity, quantity,
    cycleMonths, firstDate, contractStart, contractEnd,
    price, vat, signedDate, signatureDataUrl
  } = data;

  const safeShopName = shopName || "________";
  const safeOwnerName = ownerName || "________";
  const safeAddress = address || "________";
  const safeModel = model || "________";
  const safeCapacity = capacity || "________";
  const safeQuantity = quantity || 1;
  const displayPrice = formatCurrency(price);
  
  // Date Formatting for display
  const formatDateParts = (dateStr: string | null) => {
    if (!dateStr) return { y: "____", m: "__", d: "__" };
    const parts = dateStr.split('-');
    if (parts.length !== 3) return { y: "____", m: "__", d: "__" };
    return { y: parts[0], m: parts[1], d: parts[2] };
  };

  const firstDateParts = formatDateParts(firstDate);
  const startDateParts = formatDateParts(contractStart);
  const endDateParts = formatDateParts(contractEnd);
  
  // Use contractStart for the signature date as requested
  const signDateParts = formatDateParts(contractStart);

  const cycleCheck = (m: number) => cycleMonths === m ? "☑" : "□";

  // Force desktop padding (p-12) in printMode to ensure A4 PDF looks correct regardless of device
  // p-12 is 3rem (~48px). A4 width is 210mm (~794px). 48px is reasonable margin.
  // On mobile screen (printMode=false), use p-4 for space efficiency.
  const containerClass = printMode 
    ? "bg-white p-12 shadow-sm border border-gray-200 text-sm leading-relaxed text-gray-800"
    : "bg-white p-4 md:p-12 shadow-sm border border-gray-200 text-sm leading-relaxed text-gray-800 print:shadow-none print:border-none print:p-0";

  return (
    <div className={containerClass}>
      
      {/* Title */}
      <div className="border-b-2 border-gray-900 pb-6 mb-8">
        <h1 className="text-2xl font-bold text-center tracking-tight text-gray-900 mb-4 break-keep">업소용 제빙기 정기 위생관리 계약서(전문)</h1>
        <p className="text-gray-600 text-sm leading-6 break-keep">
          본 계약은 업소용 제빙기의 내부 위생 상태를 정기적으로 점검·관리하여 위생적인 얼음 제공 환경을 유지하기 위한 목적으로 체결된다.
        </p>
      </div>

      {/* Articles */}
      <div className="space-y-8">
        
        <section>
          <h2 className="font-bold text-gray-900 text-base mb-3">제1조 (계약 당사자)</h2>
          <div className="pl-2 space-y-2 text-gray-700">
            <p><strong>갑(고객)</strong>: {safeOwnerName} (대표자) / {safeShopName} (매장명)</p>
            <p><strong>영업장 주소</strong>: {safeAddress}</p>
            <p><strong>을(관리업체)</strong>: 이끌림잇츠케어</p>
          </div>
        </section>

        <section>
          <h2 className="font-bold text-gray-900 text-base mb-3">제2조 (계약 목적)</h2>
          <p className="text-gray-700 pl-2 break-keep">
            본 계약은 업소용 제빙기의 내부 위생 상태를 정기적으로 점검·관리함으로써 위생 사고를 예방하고 안정적인 매장 운영을 지원하는 것을 목적으로 한다.
          </p>
        </section>

        <section>
          <h2 className="font-bold text-gray-900 text-base mb-3">제3조 (관리 대상 및 범위)</h2>
          <div className="pl-2 space-y-2 text-gray-700">
            <p>관리 대상: 업소용 제빙기 <span className="inline-block border-b border-gray-400 w-12 text-center">{safeQuantity}</span>대</p>
            <p>기종: <span className="font-medium">{safeModel}</span></p>
            <p>규격/용량: <span className="font-medium">{safeCapacity}</span></p>
            <p className="break-keep">관리 범위: 내부 분해 점검, 오염 상태 확인, 스케일·이물질 제거, 위생 세척 및 살균 관리</p>
            <p className="text-gray-500 text-xs mt-1 break-keep">
              본 계약은 위생 관리 목적의 용역 계약이며, 수리·부품 교체·기능 개선은 포함하지 않는다.
            </p>
          </div>
        </section>

        <section>
          <h2 className="font-bold text-gray-900 text-base mb-3">제4조 (관리 기준, 주기 및 일정)</h2>
          <div className="pl-2 space-y-2 text-gray-700 text-sm">
            <p className="break-keep">관리는 제빙기 기종, 사용 환경, 사용량을 고려하여 완전 분해 기준으로 진행한다.</p>
            <p className="break-keep">정기관리 주기는 1개월~3개월 이내를 원칙으로 하며, 본 관리 주기는 제빙기 내부 위생 상태를 정기적으로 점검·관리하기 위한 권장 관리 기준이다.</p>
            <p className="break-keep">제빙기는 물이 지속적으로 순환되고 습도가 유지되는 구조적 특성상, 전문 위생 관리를 진행하였더라도 시간 경과에 따라 내부 오염은 점진적으로 발생할 수 있다.</p>
            <p className="break-keep">따라서 정기적인 전문 위생관리와 더불어, 영업 중 기본적인 사용 관리 및 위생 관리가 함께 이루어지는 것이 중요하다.</p>
            <p className="break-keep">본 계약에 따른 정기 위생관리는 제빙기 내부 위생 상태를 전문적으로 관리·유지하기 위한 관리 기준이며, 관리 이후의 위생 상태는 사용 환경, 사용 빈도, 급수 상태, 일상 관리 여부 등에 따라 달라질 수 있다.</p>
            <p className="break-keep">을은 사전에 협의된 일정에 맞추어 정기 위생관리 작업을 수행한다.</p>
            
            <div className="bg-gray-50 p-3 rounded border border-gray-100 mt-2">
                <p className="font-bold mb-1">정기관리 주기(선택): <span className="font-normal">{cycleCheck(1)} 1개월 &nbsp; {cycleCheck(2)} 2개월 &nbsp; {cycleCheck(3)} 3개월</span></p>
                <p><strong>첫 정기청소 일자</strong>: {firstDateParts.y}년 {firstDateParts.m}월 {firstDateParts.d}일</p>
            </div>
            
            <p className="mt-2 break-keep">정기 위생관리 일정은 ‘첫 정기청소 일자’를 기준으로 선택한 주기에 따라 월·일 기준으로 자동 산정하여 진행한다.</p>
            <p className="break-keep">영업 일정, 휴무, 야간 작업 등 부득이한 사유로 정기청소 일정 변경이 필요한 경우에는 갑과 을의 상호 협의를 통해 조정할 수 있다.</p>
          </div>
        </section>

        <section>
          <h2 className="font-bold text-gray-900 text-base mb-3">제5조 (정기관리 계약의 비용 기준)</h2>
          <div className="pl-2 space-y-2 text-gray-700">
            <p className="break-keep">본 계약은 정기적인 위생 관리를 전제로 비용이 조정 적용된 계약이다.</p>
            <p className="break-keep">정기관리 계약의 관리 비용은 일회성 위생 관리 기준 대비 약 20% 범위 내에서 조정 적용될 수 있다.</p>
            <p className="break-keep">본 비용 조정은 할인·프로모션이 아닌, 정기 관리에 따른 작업 계획 및 효율 반영 기준이다.</p>
            <p className="font-bold mt-2">회당 관리금액: <span className="text-lg">{displayPrice}</span> ( {vat === 'VAT 포함' ? '☑ VAT 포함' : '□ VAT 포함'} / {vat === 'VAT 별도' ? '☑ VAT 별도' : '□ VAT 별도'} )</p>
          </div>
        </section>

        <section>
          <h2 className="font-bold text-gray-900 text-base mb-3">제6조 (작업 중 발생 문제 처리 및 책임)</h2>
          <div className="pl-2 space-y-2 text-gray-700">
            <p className="break-keep">을은 작업 전·중 제빙기 상태 확인 과정에서 기존 노후, 부식, 구조적 문제 등이 확인될 경우 즉시 갑에게 고지한다.</p>
            <p className="break-keep">청소 작업과 직접적인 관련이 없는 수리, 부품 교체 사항은 본 계약 범위에 포함되지 않으며, 필요한 경우 사전 안내 후 진행 여부를 협의한다.</p>
            <p className="break-keep">청소 작업 과정에서 을의 과실로 인해 직접적인 손해가 발생한 경우, 을은 해당 손해에 대해 책임을 지고 원상 회복 조치를 이행한다.</p>
            <p className="break-keep">제빙기의 노후, 구조적 결함, 급수 상태, 사용 부주의 등으로 인한 문제는 본 계약에 따른 책임 범위에 포함되지 않는다.</p>
          </div>
        </section>

        <section>
            <h2 className="font-bold text-gray-900 text-base mb-3">제7조 (책임 및 의무)</h2>
            <div className="pl-2 space-y-2 text-gray-700">
                <p className="break-keep">을은 계약 내용에 따라 정해진 관리 기준과 일정에 맞추어 작업을 수행한다.</p>
                <p className="break-keep">갑은 작업이 원활히 진행될 수 있도록 전원, 급수, 작업 공간 확보 등에 협조하며, 제빙기 사용 중 이상이 있을 경우 즉시 을에게 통보한다.</p>
                <p className="break-keep">작업 중 제빙기 이상 발생 시, 해당 문제가 기존 장비의 노후 또는 구조적 결함인지, 청소 작업과 직접적인 관련이 있는 사항인지에 대해 갑과 을은 상호 확인 후 조치한다.</p>
            </div>
        </section>

        <section>
            <h2 className="font-bold text-gray-900 text-base mb-3">제8조 (정기관리 계약의 중도 해지 및 비용 정산)</h2>
            <div className="pl-2 space-y-2 text-gray-700">
                <p className="break-keep">계약 기간 중 갑의 사유로 정기관리 계약을 중도 해지할 경우, 이미 제공된 관리 서비스에 대해서는 일회성 위생 관리 기준 금액을 적용하여 재정산한다.</p>
                <p className="break-keep">정기관리 계약에 따라 조정 적용되었던 금액과 일회성 관리 기준 금액의 차액이 발생할 경우, 갑은 해당 차액을 을에게 추가 지급한다.</p>
                <p className="break-keep">본 조항은 위약금이나 손해배상이 아닌, 관리 방식 변경에 따른 비용 기준 재정산에 해당한다.</p>
                
                <div className="mt-4 bg-gray-50 border border-gray-200 rounded p-3 text-xs">
                    <p className="font-bold mb-2 text-gray-800">※ 일회성 위생관리 기준 금액 (재정산 기준표)</p>
                    <ul className="space-y-1.5 text-gray-700">
                        <li className="flex justify-between items-center border-b border-gray-100 pb-1 last:border-0 last:pb-0">
                            <span>50kg 이하 소형제빙기</span> 
                            <span className="font-bold">100,000원</span>
                        </li>
                        <li className="flex justify-between items-center border-b border-gray-100 pb-1 last:border-0 last:pb-0">
                            <span>50kg 이하 호시자키 라셀</span> 
                            <span className="font-bold">120,000원</span>
                        </li>
                        <li className="flex justify-between items-center border-b border-gray-100 pb-1 last:border-0 last:pb-0">
                            <span>50kg 이상 (중형제빙기)</span> 
                            <span className="font-bold">150,000원</span>
                        </li>
                        <li className="flex justify-between items-center">
                            <span>200kg 이상 대형제빙기</span> 
                            <span className="font-bold">200,000원</span>
                        </li>
                    </ul>
                </div>
            </div>
        </section>

        <section>
            <h2 className="font-bold text-gray-900 text-base mb-3">제9조 (계약 해지 및 변경)</h2>
            <div className="pl-2 space-y-2 text-gray-700">
                <p className="break-keep">갑 또는 을이 계약을 해지하고자 할 경우, 해지 예정일 최소 30일 전까지 서면 또는 전자적 방법으로 상대방에게 통지한다.</p>
                <p className="break-keep">천재지변, 법령 변경, 불가항력적인 사유로 인해 계약 이행이 곤란한 경우, 계약을 일시 정지하거나 해지할 수 있다.</p>
                <p className="break-keep">정기 청소 일정 변경이 필요할 경우, 상호 협의하여 조정할 수 있다.</p>
            </div>
        </section>

        <section>
            <h2 className="font-bold text-gray-900 text-base mb-3">제10조 (계약 기간)</h2>
            <div className="pl-2 space-y-2 text-gray-700 bg-gray-50 p-3 rounded border border-gray-100">
                <p><strong>계약 시작일</strong>: {startDateParts.y}년 {startDateParts.m}월 {startDateParts.d}일</p>
                <p><strong>계약 종료일</strong>: {endDateParts.y}년 {endDateParts.m}월 {endDateParts.d}일</p>
            </div>
        </section>

        <section>
            <h2 className="font-bold text-gray-900 text-base mb-3">제11조 (기타 사항 및 분쟁 해결)</h2>
            <div className="pl-2 space-y-2 text-gray-700">
                <p className="break-keep">본 계약서에 명시되지 않은 사항은 갑과 을이 상호 협의하여 정하며, 관련 법령 및 일반적인 거래 관행을 따른다.</p>
                <p className="break-keep">본 계약과 관련하여 분쟁이 발생할 경우, 상호 협의를 통해 해결하도록 노력한다.</p>
                <p className="break-keep">협의로 해결되지 않을 경우, 을의 사업장 소재지를 관할하는 법원을 전속 관할 법원으로 한다.</p>
            </div>
        </section>
        
        <div className="border-t-2 border-gray-800 my-8"></div>

        {/* Signatures */}
        <div className="bg-gray-50 p-8 rounded-lg border border-gray-200">
            <h3 className="font-bold text-xl text-center mb-6">계약 확인 및 서명</h3>
            <p className="text-center text-gray-500 mb-8 break-keep">본 계약 내용을 충분히 이해하고 이에 동의하여 본 계약을 체결한다.</p>
            
            <p className="text-center font-bold mb-8 text-gray-800">서명일: {signDateParts.y}년 {signDateParts.m}월 {signDateParts.d}일</p>
            
            <div className="flex justify-center">
                <div className="w-full max-w-md flex flex-col gap-3">
                    <h4 className="font-bold text-lg mb-2 text-gray-900 border-b border-gray-300 pb-2">계약자 (고객)</h4>
                    
                    <div className="flex items-center justify-between">
                         <span className="text-gray-600 w-24">상호(매장명):</span>
                         <span className="font-medium flex-1 text-right">{safeShopName}</span>
                    </div>

                    <div className="flex items-center justify-between">
                         <span className="text-gray-600 w-24">성명(대표자):</span>
                         <span className="font-medium flex-1 text-right">{safeOwnerName}</span>
                         <span className="ml-2 text-gray-400 text-xs">(서명)</span>
                    </div>

                    <div className="h-40 border border-gray-300 bg-white rounded flex items-center justify-center overflow-hidden relative mt-2">
                        {signatureDataUrl ? (
                            <img src={signatureDataUrl} alt="Signature" className="h-full object-contain" />
                        ) : (
                            <span className="text-gray-300 text-sm">서명란</span>
                        )}
                    </div>
                </div>
            </div>
        </div>

      </div>
    </div>
  );
};

export default ContractPaper;
