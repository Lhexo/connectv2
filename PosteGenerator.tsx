import React, { useState, useEffect, useRef } from 'react';
import { 
  FileCode, 
  Upload, 
  Download, 
  CheckCircle2, 
  AlertCircle, 
  AlertTriangle, 
  Save, 
  Trash2, 
  Edit3, 
  Info, 
  ShieldCheck, 
  Plus, 
  ChevronDown, 
  ChevronUp, 
  Settings2,
  SlidersHorizontal,
  Sparkles,
  Truck,
  Box
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface SenderConfig {
  channel: string;
  contractCode: string;
  costCenter: string;
  clientIdentifier: string;
  productType: string;
  senderName: string;
  senderContactRef: string;
  senderEmail: string;
  senderPhone: string;
  senderMobile: string;
  senderVia: string;
  senderCivic: string;
  senderCap: string;
  senderLocalita: string;
  senderProvincia: string;
  senderCountryCode: string;
  senderCountryName: string;
  senderNotes: string;
}

interface DestinationRow {
  id: string;
  docNumber: string;
  recipientName: string;
  contattoDestinatarioRef: string;
  email: string;
  telefono: string;
  cellulare: string;
  via: string;
  civico: string;
  cap: string;
  localita: string;
  provincia: string;
  country: string;
  nazioneDestinatario: string;
  note: string;

  // Pickup fields (RITIRO)
  ritiroName: string;
  ritiroContactRef: string;
  ritiroEmail: string;
  ritiroPhone: string;
  ritiroMobile: string;
  ritiroVia: string;
  ritiroCivic: string;
  ritiroCap: string;
  ritiroLocalita: string;
  ritiroProvincia: string;
  ritiroCountry: string;
  ritiroCountryName: string;
  ritiroNotes: string;

  // Package & Shipment
  idLdv: string;
  identificativoCollo: string;
  colli: string;
  peso: string;
  larghezza: string;
  altezza: string;
  profondita: string;
  ritiroVolumetrico: string;
  dataSpedizioneRitiro: string;
  contenuto: string;
  barcodeServizio: string;

  // Cash on delivery & Options
  importoContrassegno: string;
  tipoPagamento: string;
  importoCoperturaFull: string;
  codiceAndataRitorno: string;
  consegnaGiornoOrarioDefinitoProgrammata: string;
  noteFasceOrarie: string;
  valuta: string;
  frazionarioPuntoposte: string;
  nomeUfficioPostale: string;
  flagAscensore: string;
  mancataConsegna: string;
  destVicino: string;
  valoreSpedizione: string;
  addebitoOneri: string;
  tipoImballo: string;
  identificativoFiscale: string;
  tipoContenuto: string;
  dataRichiestaConsegna: string;
  inizioFasciaOrariaConsegna: string;
  fineFasciaOrariaConsegna: string;

  packages?: {
    id: string;
    peso: string;
    larghezza: string;
    altezza: string;
    profondita: string;
  }[];

  validation: {
    nameError: boolean;
    addressError: boolean;
    civicWarning: boolean;
    capError: boolean;
    localitaError: boolean;
    provinciaError: boolean;
    genericCapError: boolean;
    pesoError: boolean;
    contrassegnoError: boolean;
    reverseError: boolean;
    accessoryError: boolean;
    hasErrors: boolean;
    hasWarnings: boolean;
    messages: string[];
    warnings: string[];
  };
}

const DEFAULT_CONFIG: SenderConfig = {
  channel: 'POSTE',
  contractCode: '',
  costCenter: '',
  clientIdentifier: '',
  productType: 'Poste Delivery Business',
  senderName: '',
  senderContactRef: '',
  senderEmail: '',
  senderPhone: '',
  senderMobile: '',
  senderVia: '',
  senderCivic: '',
  senderCap: '',
  senderLocalita: '',
  senderProvincia: '',
  senderCountryCode: 'IT',
  senderCountryName: 'ITALIA',
  senderNotes: ''
};

// Schema driven dynamic editor subsections inside expandable row
const ADVANCED_SECTIONS = [
  {
    title: "Dati Destinatario Avanzati",
    fields: [
      { key: 'contattoDestinatarioRef', label: 'Contatto Rif. Destinatario', type: 'text', placeholder: 'Es. Referente Rossi' },
      { key: 'cellulare', label: 'Cellulare Destinatario', type: 'text', placeholder: 'Es. 3331234567' },
      { key: 'identificativoFiscale', label: 'Codice Fiscale / P.IVA', type: 'text', placeholder: 'Es. 01234567890' },
      { key: 'nazioneDestinatario', label: 'Nazione Completa', type: 'text', placeholder: 'Es. ITALIA' },
      { key: 'note', label: 'Note Consegna / Note1', type: 'text', placeholder: 'Es. Consegnare nel pomeriggio' }
    ]
  },
  {
    title: "Pacco & Dimensioni",
    fields: [
      { key: 'larghezza', label: 'Larghezza (cm)', type: 'text', placeholder: 'Es. 20' },
      { key: 'altezza', label: 'Altezza (cm)', type: 'text', placeholder: 'Es. 15' },
      { key: 'profondita', label: 'Profondità (cm)', type: 'text', placeholder: 'Es. 30' },
      { key: 'tipoImballo', label: 'Tipo Imballo', type: 'text', placeholder: 'Es. SCATOLA' },
      { key: 'contenuto', label: 'Descrizione Contenuto', type: 'text', placeholder: 'Es. Cosmetici' },
      { key: 'ritiroVolumetrico', label: 'Ritiro Volumetrico', type: 'select', options: ['', 'SI', 'NO'] }
    ]
  },
  {
    title: "Contrassegno & Finanza",
    fields: [
      { key: 'importoContrassegno', label: 'Importo Contrassegno (€)', type: 'text', placeholder: 'Es. 45.90' },
      { key: 'tipoPagamento', label: 'Tipo Pagamento', type: 'select', options: ['', 'CONTANTI', 'ASS_POSTALE', 'VAGLIA'] },
      { key: 'importoCoperturaFull', label: 'Assicurazione Full (€)', type: 'text', placeholder: 'Es. 100.00' },
      { key: 'valoreSpedizione', label: 'Valore Spedizione (€)', type: 'text', placeholder: 'Es. 150.00' },
      { key: 'valuta', label: 'Valuta', type: 'text', placeholder: 'EUR' },
      { key: 'mancataConsegna', label: 'In caso di Mancata Consegna', type: 'select', options: ['RITORNO_AL_MITTENTE', 'ABBANDONO'] }
    ]
  },
  {
    title: "Consegna & Orari",
    fields: [
      { key: 'consegnaGiornoOrarioDefinitoProgrammata', label: 'Consegna Programmata', type: 'text', placeholder: 'Es. Sabato mattina' },
      { key: 'noteFasceOrarie', label: 'Fasce Orarie Note', type: 'text', placeholder: 'Es. Solo ore ufficio' },
      { key: 'flagAscensore', label: 'Piano / Ascensore', type: 'select', options: ['', 'SI', 'NO'] },
      { key: 'destVicino', label: 'Consegna a Vicino', type: 'select', options: ['', 'SI', 'NO'] },
      { key: 'nomeUfficioPostale', label: 'Fermo Posta: Ufficio Postale', type: 'text', placeholder: 'Es. Roma Nomentano' },
      { key: 'frazionarioPuntoposte', label: 'Frazionario Punto Poste', type: 'text', placeholder: 'Es. 123456' },
      { key: 'dataRichiestaConsegna', label: 'Data Consegna Richiesta', type: 'date' },
      { key: 'inizioFasciaOrariaConsegna', label: 'Ora Inizio Consegna', type: 'time' },
      { key: 'fineFasciaOrariaConsegna', label: 'Ora Fine Consegna', type: 'time' }
    ]
  }
];

export default function PosteGenerator() {
  const [selectedCarrier, setSelectedCarrier] = useState<'poste' | 'gls'>('poste');
  const [config, setConfig] = useState<SenderConfig>(DEFAULT_CONFIG);
  const [isSaved, setIsSaved] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsedRows, setParsedRows] = useState<DestinationRow[]>([]);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  
  // Quick inline-edit state for the table grid cells
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [tempEditValue, setTempEditValue] = useState<string>('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem('poste_sender_config');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setConfig({
          ...DEFAULT_CONFIG,
          ...parsed
        });
        setIsSaved(true);
      } catch (e) {
        console.error('Failed to load sender config from localStorage', e);
      }
    }
  }, []);

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('poste_sender_config', JSON.stringify(config));
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const handleConfigChange = (field: keyof SenderConfig, value: string) => {
    setConfig(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const checkIsProvinceCapital = (city: string, prov: string): boolean => {
    if (!city || !prov) return false;
    const c = city.trim().toLowerCase();
    const p = prov.trim().toUpperCase();

    // Map of Italian province codes to standard lowercase capital names
    const capitali: Record<string, string[]> = {
      AG: ["agrigento"],
      AL: ["alessandria"],
      AN: ["ancona"],
      AO: ["aosta"],
      AR: ["arezzo"],
      AP: ["ascoli piceno", "ascoli"],
      AT: ["asti"],
      AV: ["avellino"],
      BA: ["bari"],
      BT: ["barletta", "andria", "trani", "barletta-andria-trani"],
      BL: ["belluno"],
      BN: ["benevento"],
      BG: ["bergamo"],
      BI: ["biella"],
      BO: ["bologna"],
      BZ: ["bolzano"],
      BS: ["brescia"],
      BR: ["brindisi"],
      CA: ["cagliari"],
      CL: ["caltanissetta"],
      CB: ["campobasso"],
      CE: ["caserta"],
      CZ: ["catanzaro"],
      CH: ["chieti"],
      CO: ["como"],
      CS: ["cosenza"],
      CR: ["cremona"],
      KR: ["crotone"],
      CN: ["cuneo"],
      EN: ["enna"],
      FM: ["fermo"],
      FE: ["ferrara"],
      FI: ["firenze"],
      FG: ["foggia"],
      FC: ["forli", "forlì", "cesena", "forli-cesena", "forlì-cesena"],
      FR: ["frosinone"],
      GE: ["genova"],
      GO: ["gorizia"],
      GR: ["grosseto"],
      IM: ["imperia"],
      IS: ["isernia"],
      SP: ["la spezia", "spezia"],
      AQ: ["l'aquila", "aquila"],
      LT: ["latina"],
      LE: ["lecce"],
      LC: ["lecco"],
      LI: ["livorno"],
      LO: ["lodi"],
      LU: ["lucca"],
      MC: ["macerata"],
      MN: ["mantova"],
      MS: ["massa", "carrara", "massa-carrara"],
      MT: ["matera"],
      ME: ["messina"],
      MI: ["milano"],
      MO: ["modena"],
      MB: ["monza", "monza e della brianza", "monza-brianza"],
      NA: ["napoli"],
      NO: ["novara"],
      NU: ["nuoro"],
      OR: ["oristano"],
      PD: ["padova"],
      PA: ["palermo"],
      PR: ["parma"],
      PV: ["pavia"],
      PG: ["perugia"],
      PU: ["pesaro", "urbino", "pesaro e urbino", "pesaro-urbino"],
      PE: ["pescara"],
      PC: ["piacenza"],
      PI: ["pisa"],
      PT: ["pistoia"],
      PN: ["pordenone"],
      PZ: ["potenza"],
      PO: ["prato"],
      RG: ["ragusa"],
      RA: ["ravenna"],
      RC: ["reggio calabria", "reggio di calabria"],
      RE: ["reggio emilia", "reggio nell'emilia"],
      RI: ["rieti"],
      RN: ["rimini"],
      RM: ["roma", "rome"],
      RO: ["rovigo"],
      SA: ["salerno"],
      SS: ["sassari"],
      SV: ["savona"],
      SI: ["siena"],
      SR: ["siracusa"],
      SO: ["sondrio"],
      SU: ["sud sardegna", "carbonia", "iglesias"],
      TA: ["taranto"],
      TE: ["teramo"],
      TR: ["terni"],
      TO: ["torino", "turin"],
      TP: ["trapani"],
      TN: ["trento"],
      TV: ["treviso"],
      TS: ["trieste"],
      UD: ["udine"],
      VA: ["varese"],
      VE: ["venezia", "venice"],
      VB: ["verbania", "domodossola", "verbano-cusio-ossola"],
      VC: ["vercelli"],
      VR: ["verona"],
      VV: ["vibo valentia", "vibo"],
      VI: ["vicenza"],
      VT: ["viterbo"]
    };

    const capitalsForProv = capitali[p];
    if (!capitalsForProv) return false;
    
    return capitalsForProv.some(capName => c.includes(capName) || capName.includes(c));
  };

  const splitAddress = (fullAddress: string): { street: string; number: string } => {
    if (!fullAddress) return { street: '', number: '' };
    
    const commaParts = fullAddress.split(',');
    if (commaParts.length > 1) {
      const lastPart = commaParts[commaParts.length - 1].trim();
      if (/^\d+/i.test(lastPart)) {
        const street = commaParts.slice(0, -1).join(',').trim();
        return { street, number: lastPart };
      }
    }

    const regex = /(?:\s+)(\d+(?:\s*[\w\/\-\s]+)?)$/i;
    const match = fullAddress.trim().match(regex);
    if (match) {
      const number = match[1].trim();
      const streetIndex = fullAddress.lastIndexOf(match[0]);
      const street = fullAddress.substring(0, streetIndex).trim();
      return { street, number };
    }
    
    return { street: fullAddress.trim(), number: '' };
  };

  const validateRow = (row: Partial<DestinationRow>): DestinationRow['validation'] => {
    const messages: string[] = [];
    const warnings: string[] = [];

    // 1. Standard Fields (name, address, cap, localita, provincia)
    const nameError = !row.recipientName || row.recipientName.trim().length === 0;
    if (nameError) messages.push("Ragione Sociale del destinatario mancante.");

    const addressError = !row.via || row.via.trim().length === 0;
    if (addressError) messages.push("Indirizzo del destinatario mancante.");

    const civicWarning = !row.civico || row.civico.trim().length === 0;
    if (civicWarning) warnings.push("Numero civico consigliato.");

    const capVal = row.cap ? row.cap.trim() : '';
    const capError = !capVal || !/^\d{5}$/.test(capVal);
    if (capError) {
      messages.push("CAP del destinatario deve essere composto da 5 cifre.");
    }

    const localitaError = !row.localita || row.localita.trim().length === 0;
    if (localitaError) messages.push("Località del destinatario mancante.");

    const provVal = row.provincia ? row.provincia.trim() : '';
    const provinciaError = !provVal || !/^[A-Za-z]{2}$/.test(provVal);
    if (provinciaError) {
      messages.push("Provincia del destinatario deve essere di 2 lettere.");
    }

    // 2. Prohibited Generic CAP (ending in 00 for multi-CAP cities like Rome, Milan, Naples, etc.)
    const isGenericCap = (c: string): boolean => /^\d{3}00$/.test(c);
    const genericCapVal = isGenericCap(capVal);
    let genericCapError = false;
    if (genericCapVal) {
      const isCapoluogo = checkIsProvinceCapital(row.localita || '', provVal);
      if (isCapoluogo) {
        warnings.push(`Il CAP '${capVal}' è generico ma valido poiché corrisponde al capoluogo (${row.localita}).`);
      } else {
        messages.push(`Il CAP '${capVal}' è un CAP generico non valido per la località inserita (${row.localita}). Usa il CAP specifico del comune/località.`);
        genericCapError = true;
      }
    }

    // 3. PESO_COLLO (Mandatory, must be a valid number > 0)
    const pesoVal = row.peso ? row.peso.toString().replace(',', '.').trim() : '';
    const numPeso = parseFloat(pesoVal);
    const pesoError = !pesoVal || isNaN(numPeso) || numPeso <= 0;
    if (pesoError) {
      messages.push("Il peso del collo è obbligatorio e deve essere maggiore di 0 kg.");
    }

    // 4. Product / Accessories & Barcode Services Validation
    const barcodes = (row.barcodeServizio || '').split('|').map(s => s.trim().toUpperCase()).filter(Boolean);
    
    // Contrassegno (APT000918)
    const hasContrassegnoImporto = !!row.importoContrassegno && parseFloat(row.importoContrassegno.toString().replace(',', '.')) > 0;
    const hasContrassegnoBarcode = barcodes.includes('APT000918');
    let contrassegnoError = false;
    if (hasContrassegnoImporto || hasContrassegnoBarcode) {
      const imp = row.importoContrassegno ? parseFloat(row.importoContrassegno.replace(',', '.')) : 0;
      const payType = (row.tipoPagamento || '').trim().toUpperCase();
      const validPayTypes = ['CON', 'ACM', 'ABM', 'CONTANTI', 'ASS_POSTALE', 'VAGLIA'];
      if (!imp || isNaN(imp) || imp <= 0) {
        messages.push("Importo contrassegno non valido (deve essere maggiore di 0).");
        contrassegnoError = true;
      }
      if (!payType || !validPayTypes.some(t => payType.includes(t))) {
        messages.push("Tipo pagamento per contrassegno mancante o non valido. Scegli tra: CONTANTI (CON), ACM, ABM.");
        contrassegnoError = true;
      }
    }

    // Copertura Full (APT000919)
    const hasCoperturaFullImporto = !!row.importoCoperturaFull && parseFloat(row.importoCoperturaFull.toString().replace(',', '.')) > 0;
    const hasCoperturaFullBarcode = barcodes.includes('APT000919');
    let accessoryError = false;
    if (hasCoperturaFullImporto || hasCoperturaFullBarcode) {
      const imp = row.importoCoperturaFull ? parseFloat(row.importoCoperturaFull.replace(',', '.')) : 0;
      if (!imp || isNaN(imp) || imp <= 0) {
        messages.push("Importo Copertura Full (campo 59) non valido.");
        accessoryError = true;
      }
    }

    // PuntoPoste Locker (APT000948) or Ufficio Postale (APT000949)
    const hasLocker = barcodes.includes('APT000948');
    const hasUfficioPostale = barcodes.includes('APT000949');
    if (hasLocker || hasUfficioPostale || !!row.frazionarioPuntoposte) {
      if (!row.frazionarioPuntoposte || row.frazionarioPuntoposte.trim().length === 0) {
        messages.push("Il codice frazionario PuntoPoste (campo 64) è obbligatorio per consegne a Locker/Ufficio Postale.");
        accessoryError = true;
      }
    }

    // Consegna al Vicino (APT000914)
    const hasVicino = barcodes.includes('APT000914');
    if (hasVicino || !!row.destVicino) {
      if (!row.destVicino || row.destVicino.trim().length === 0 || row.destVicino.trim() === 'NO') {
        messages.push("Il nome del vicino (campo 68) è obbligatorio per l'opzione Consegna al Vicino.");
        accessoryError = true;
      }
    }

    // Multicollo (APT000945)
    const colliNum = parseInt(row.colli || '1');
    if (colliNum > 1 && !barcodes.includes('APT000945')) {
      warnings.push("Per spedizioni multicollo (colli > 1) è raccomandato inserire l'opzione APT000945 nel Barcode Servizio.");
    }

    let packagesError = false;
    if (colliNum > 1) {
      if (row.packages && row.packages.length > 0) {
        if (row.packages.length !== colliNum) {
          warnings.push(`Hai dichiarato ${colliNum} colli ma configurato dettagli per ${row.packages.length} colli.`);
        }
        
        let sumPkgsWeight = 0;
        row.packages.forEach((pkg, index) => {
          const pkgPesoVal = (pkg.peso || '').toString().replace(',', '.').trim();
          const pkgNumPeso = parseFloat(pkgPesoVal);
          if (!pkgPesoVal || isNaN(pkgNumPeso) || pkgNumPeso <= 0) {
            messages.push(`Collo #${index + 1}: Il peso è obbligatorio e deve essere maggiore di 0 kg.`);
            packagesError = true;
          } else {
            sumPkgsWeight += pkgNumPeso;
            if (pkgNumPeso > 30) {
              warnings.push(`Collo #${index + 1}: Il peso inserito (${pkgNumPeso} kg) supera i 30 kg. Poste Italiane richiede la movimentazione speciale (sponda idraulica) o potrebbe addebitare tariffe extra.`);
            }
          }

          const w = parseFloat(pkg.larghezza || '0');
          const h = parseFloat(pkg.altezza || '0');
          const d = parseFloat(pkg.profondita || '0');
          if (w <= 0 || h <= 0 || d <= 0) {
            warnings.push(`Collo #${index + 1}: Alcune dimensioni sono mancanti o uguali a 0. Clicca su "Configura su tutti" o imposta le dimensioni individuali.`);
          } else {
            const sumSides = w + h + d;
            if (sumSides > 150) {
              warnings.push(`Collo #${index + 1}: La somma delle dimensioni (${sumSides} cm) supera i 150 cm. Potrebbero essere applicati supplementi per pacco fuori formato.`);
            }
            // Volumetric weight calculation (W * H * D) / 5000
            const volWeight = (w * h * d) / 5000;
            if (!isNaN(pkgNumPeso) && volWeight > pkgNumPeso) {
              warnings.push(`Collo #${index + 1}: Il peso volumetrico stimato (${volWeight.toFixed(2)} kg) è superiore al peso reale (${pkgNumPeso} kg). Poste Italiane potrebbe fatturare la spedizione in base al volume.`);
            }
          }
        });

        // Compare sum of packages weights to the main row weight
        const mainWeight = parseFloat(pesoVal);
        if (!isNaN(mainWeight) && !isNaN(sumPkgsWeight) && Math.abs(sumPkgsWeight - mainWeight) > 0.1) {
          warnings.push(`Il peso complessivo dei colli (${sumPkgsWeight.toFixed(2)} kg) differisce dal peso totale dichiarato della spedizione (${mainWeight.toFixed(2)} kg).`);
        }

      } else {
        warnings.push("Per spedizioni multicollo è consigliato configurare le dimensioni specifiche per ciascun collo nel dettaglio sottostante.");
      }

      // Multicollo trace alerts
      if (!row.cellulare && !row.email) {
        warnings.push("Spedizione Multicollo: È caldamente consigliato indicare il Cellulare o l'Email del destinatario per ricevere le notifiche Smart Alert su ciascun collo spedito.");
      }
    } else {
      // Single package extra-info warnings
      const mainWeight = parseFloat(pesoVal);
      if (!isNaN(mainWeight) && mainWeight > 30) {
        warnings.push(`Pacco Singolo: Il peso inserito (${mainWeight} kg) supera i 30 kg. Poste Italiane potrebbe richiedere movimentazione speciale (sponda idraulica) o rifiutare la spedizione standard.`);
      }

      const w = parseFloat(row.larghezza || '0');
      const h = parseFloat(row.altezza || '0');
      const d = parseFloat(row.profondita || '0');
      if (w > 0 && h > 0 && d > 0) {
        const sumSides = w + h + d;
        if (sumSides > 150) {
          warnings.push(`Pacco Singolo: La somma delle dimensioni (${sumSides} cm) supera i 150 cm limitrofi del formato standard (supplemento Fuori Formato applicabile).`);
        }
        const volWeight = (w * h * d) / 5000;
        if (!isNaN(mainWeight) && volWeight > mainWeight) {
          warnings.push(`Pacco Singolo: Il peso volumetrico stimato (${volWeight.toFixed(2)} kg) supera il peso reale (${mainWeight} kg). Attenzione ad eventuali ricalcoli tariffari di Poste.`);
        }
      }
    }

    // Reverse (APT000979, APT000980, APT000981, APT000928)
    const reverseCodes = barcodes.filter(c => ['APT000979', 'APT000980', 'APT000981', 'APT000928'].includes(c));
    let reverseError = false;
    if (reverseCodes.length > 1) {
      messages.push("È consentito indicare un solo canale di accettazione Reverse tra quelli possibili (APT000979, APT000980, APT000981, APT000928).");
      reverseError = true;
    } else if (reverseCodes.length === 1) {
      const activeReverse = reverseCodes[0];
      const w = numPeso || 1.0;
      
      const width = parseFloat(row.larghezza || '10');
      const height = parseFloat(row.altezza || '10');
      const depth = parseFloat(row.profondita || '10');
      const sortedDims = [width, height, depth].sort((a,b) => a-b);
      const maxSide = Math.max(width, height, depth);
      const sumDims = width + height + depth;

      if (activeReverse === 'APT000980' || activeReverse === 'APT000979') {
        // Locker/PuntoPoste: dimensions < 36x37x56 cm and weight < 15 Kg
        if (sortedDims[0] > 36 || sortedDims[1] > 37 || sortedDims[2] > 56 || w >= 15) {
          messages.push(`Le dimensioni/peso (${width}x${height}x${depth}cm, ${w}kg) superano i limiti per PuntoPoste/Locker (max 36x37x56 cm, < 15 Kg).`);
          reverseError = true;
        }
      } else if (activeReverse === 'APT000981') {
        // Ufficio Postale: sum of 3 dims < 150 cm, longest side < 100 cm, weight < 30 Kg
        if (sumDims >= 150 || maxSide >= 100 || w >= 30) {
          messages.push(`Le dimensioni/peso superano i limiti dell'Ufficio Postale (somma lati < 150cm, lato lungo < 100cm, peso < 30 Kg).`);
          reverseError = true;
        }
      }
    }

    // Smart Alert Warning
    if (!row.email && !row.cellulare) {
      warnings.push("Email o Cellulare consigliati per abilitare gli Smart Alert del destinatario (prerequisito ScegliTu).");
    }

    const hasErrors = nameError || addressError || capError || localitaError || provinciaError || genericCapError || pesoError || contrassegnoError || reverseError || accessoryError || packagesError;
    const hasWarnings = civicWarning || warnings.length > 0;

    return {
      nameError,
      addressError,
      civicWarning,
      capError,
      localitaError,
      provinciaError,
      genericCapError,
      pesoError,
      contrassegnoError,
      reverseError,
      accessoryError,
      hasErrors,
      hasWarnings,
      messages,
      warnings
    };
  };

  const autoFixRow = (row: DestinationRow): { fixedRow: DestinationRow; logs: string[] } => {
    const logs: string[] = [];
    const updated = { ...row };

    // 1. CAP Padding: if numeric and less than 5 digits (e.g. 6061 -> 06061)
    let capVal = (updated.cap || '').trim();
    if (capVal && /^\d+$/.test(capVal) && capVal.length < 5) {
      const paddedCap = capVal.padStart(5, '0');
      logs.push(`CAP: formattato da '${capVal}' a '${paddedCap}' (aggiunti zeri iniziali).`);
      updated.cap = paddedCap;
      capVal = paddedCap;
    }

    // 2. Provincia Normalization: force uppercase and limit to 2 chars (e.g. "to" -> "TO")
    let provVal = (updated.provincia || '').trim();
    if (provVal && provVal.length > 0) {
      let cleanedProv = provVal.toUpperCase();
      if (cleanedProv.length > 2) {
        cleanedProv = cleanedProv.substring(0, 2);
      }
      if (cleanedProv !== provVal) {
        logs.push(`Provincia: normalizzata da '${provVal}' a '${cleanedProv}'.`);
        updated.provincia = cleanedProv;
        provVal = cleanedProv;
      }
    }

    // 3. Weight normalization: default to 1.0 if empty, <=0 or invalid
    const pesoVal = (updated.peso || '').toString().replace(',', '.').trim();
    const numPeso = parseFloat(pesoVal);
    if (!pesoVal || isNaN(numPeso) || numPeso <= 0) {
      logs.push(`Peso: impostato a 1.0 kg (era nullo o non valido).`);
      updated.peso = '1.0';
    } else {
      if (updated.peso !== pesoVal) {
        updated.peso = pesoVal;
      }
    }

    // 4. Content prefill: default to 'Merci' if empty
    if (!updated.contenuto || updated.contenuto.trim().length === 0) {
      logs.push(`Contenuto: impostato a 'Merci' (era vuoto).`);
      updated.contenuto = 'Merci';
    }

    // 5. Barcodes automatic management
    let barcodes = (updated.barcodeServizio || '').split('|').map(s => s.trim().toUpperCase()).filter(Boolean);
    const originalBarcodesCount = barcodes.length;

    // Multicollo (APT000945)
    const colliNum = parseInt(updated.colli || '1');
    if (colliNum > 1 && !barcodes.includes('APT000945')) {
      barcodes.push('APT000945');
      logs.push(`Barcode: aggiunto 'APT000945' (Multicollo) per spedizione di ${colliNum} colli.`);
    }

    if (colliNum > 1) {
      if (!updated.packages || updated.packages.length === 0) {
        const totalWeight = parseFloat(pesoVal) || 1.0;
        const singleWeight = (totalWeight / colliNum).toFixed(2);
        const pkgs = [];
        for (let idx = 0; idx < colliNum; idx++) {
          pkgs.push({
            id: `pkg-fix-${Date.now()}-${idx}`,
            peso: singleWeight,
            larghezza: updated.larghezza || '10',
            altezza: updated.altezza || '10',
            profondita: updated.profondita || '10'
          });
        }
        updated.packages = pkgs;
        logs.push(`Colli: inizializzati dettagli per ${colliNum} colli con pesi e dimensioni.`);
      }
    }

    // Contrassegno (APT000918)
    const hasContrassegnoImporto = !!updated.importoContrassegno && parseFloat(updated.importoContrassegno.toString().replace(',', '.')) > 0;
    if (hasContrassegnoImporto && !barcodes.includes('APT000918')) {
      barcodes.push('APT000918');
      logs.push(`Barcode: aggiunto 'APT000918' (Contrassegno) rilevando l'importo di €${updated.importoContrassegno}.`);
    }

    // Auto-set tipoPagamento to CONTANTI (CON) if contrassegno active and empty/invalid
    if ((hasContrassegnoImporto || barcodes.includes('APT000918'))) {
      const payType = (updated.tipoPagamento || '').trim().toUpperCase();
      const validPayTypes = ['CON', 'ACM', 'ABM', 'CONTANTI', 'ASS_POSTALE', 'VAGLIA'];
      if (!payType || !validPayTypes.some(t => payType.includes(t))) {
        logs.push(`Pagamento: impostato tipo a 'CONTANTI (CON)' per il contrassegno.`);
        updated.tipoPagamento = 'CON';
      }
    }

    // Copertura Full (APT000919)
    const hasCoperturaFullImporto = !!updated.importoCoperturaFull && parseFloat(updated.importoCoperturaFull.toString().replace(',', '.')) > 0;
    if (hasCoperturaFullImporto && !barcodes.includes('APT000919')) {
      barcodes.push('APT000919');
      logs.push(`Barcode: aggiunto 'APT000919' (Copertura Full) per l'importo assicurato di €${updated.importoCoperturaFull}.`);
    }

    // Consegna al Vicino (APT000914)
    const hasVicinoText = !!updated.destVicino && updated.destVicino.trim().length > 0 && updated.destVicino.trim().toUpperCase() !== 'NO';
    if (hasVicinoText && !barcodes.includes('APT000914')) {
      barcodes.push('APT000914');
      logs.push(`Barcode: aggiunto 'APT000914' (Consegna al Vicino) per il vicino '${updated.destVicino}'.`);
    }

    // PuntoPoste Locker (APT000948) or Ufficio Postale (APT000949) depending on code
    const hasFrazionario = !!updated.frazionarioPuntoposte && updated.frazionarioPuntoposte.trim().length > 0;
    if (hasFrazionario && !barcodes.includes('APT000948') && !barcodes.includes('APT000949')) {
      // Default to Locker APT000948 if missing
      barcodes.push('APT000948');
      logs.push(`Barcode: aggiunto 'APT000948' (PuntoPoste Locker) per codice frazionario ${updated.frazionarioPuntoposte}.`);
    }

    if (barcodes.length !== originalBarcodesCount) {
      updated.barcodeServizio = barcodes.join('|');
    }

    // Update validation
    updated.validation = validateRow(updated);

    return { fixedRow: updated, logs };
  };

  const parseDaneaXml = (xmlText: string) => {
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
      
      const documents = xmlDoc.getElementsByTagName('Document');
      if (documents.length === 0) {
        alert("Nessun nodo <Document> trovato nel file XML. Assicurati che sia un file XML valido esportato da Danea Easyfatt.");
        return;
      }

      const rows: DestinationRow[] = [];

      for (let i = 0; i < documents.length; i++) {
        const doc = documents[i];
        
        const getTagValue = (tagName: string): string => {
          const element = doc.getElementsByTagName(tagName)[0];
          return element ? element.textContent || '' : '';
        };

        const docNumber = getTagValue('Number') || getTagValue('DocNumber') || `DDT-${i+1}`;
        
        // Prioritize Delivery... over Customer... according to Danea standard
        const recipientName = getTagValue('DeliveryName') || getTagValue('CustomerName') || getTagValue('Customer') || getTagValue('Name') || '';
        const originalAddress = getTagValue('DeliveryAddress') || getTagValue('CustomerAddress') || getTagValue('Address') || '';
        const cap = getTagValue('DeliveryPostcode') || getTagValue('CustomerPostcode') || getTagValue('CustomerPostCode') || getTagValue('Postcode') || getTagValue('Cap') || '';
        const localita = getTagValue('DeliveryCity') || getTagValue('CustomerCity') || getTagValue('City') || getTagValue('Localita') || '';
        const provincia = getTagValue('DeliveryProvince') || getTagValue('CustomerProvince') || getTagValue('Province') || getTagValue('Provincia') || '';
        const country = getTagValue('DeliveryCountry') || getTagValue('CustomerCountry') || getTagValue('Country') || getTagValue('Nazione') || 'IT';
        
        const telefono = getTagValue('CustomerTel') || getTagValue('CustomerPhone') || getTagValue('Phone') || getTagValue('Telefono') || '';
        const cellulare = getTagValue('CustomerCellPhone') || getTagValue('CustomerCell') || getTagValue('Cellulare') || '';
        const email = getTagValue('CustomerEmail') || getTagValue('Email') || '';
        
        // Transport Info extraction
        const carrier = getTagValue('Carrier') || '';
        const transportReason = getTagValue('TransportReason') || '';
        const goodsAppearance = getTagValue('GoodsAppearance') || '';
        const transportDateTime = getTagValue('TransportDateTime') || '';
        const shipmentTerms = getTagValue('ShipmentTerms') || '';
        const trackingNumber = getTagValue('TrackingNumber') || '';

        // Prioritize TransportedWeight over TotalWeight / Weight
        const peso = getTagValue('TransportedWeight') || getTagValue('TotalWeight') || getTagValue('Weight') || '1.0';
        const colli = getTagValue('NumOfPieces') || getTagValue('Pieces') || getTagValue('Colli') || '1';
        
        // Extra features from Danea XML
        const fiscalCode = getTagValue('CustomerFiscalCode') || getTagValue('CustomerVatCode') || getTagValue('FiscalCode') || getTagValue('VatCode') || '';
        const paymentName = getTagValue('PaymentName') || getTagValue('Payment') || '';
        const totalAmount = getTagValue('Total') || getTagValue('Amount') || getTagValue('PaymentAmount') || '';
        
        // Comments & Custom Fields
        const internalComment = getTagValue('InternalComment') || '';
        const customField1 = getTagValue('CustomField1') || '';
        const customField2 = getTagValue('CustomField2') || '';
        const customField3 = getTagValue('CustomField3') || '';
        const customField4 = getTagValue('CustomField4') || '';
        const footNotes = getTagValue('FootNotes') || '';
        const deliveryNotes = getTagValue('DeliveryNotes') || getTagValue('Notes') || getTagValue('InternalNotes') || '';
        
        // Construct rich notes to retain all extracted info
        const notesList = [
          deliveryNotes || internalComment,
          transportReason ? `Causale: ${transportReason}` : '',
          goodsAppearance ? `Aspetto: ${goodsAppearance}` : '',
          shipmentTerms ? `Porto: ${shipmentTerms}` : '',
          carrier ? `Corr: ${carrier}` : '',
          trackingNumber ? `Rif: ${trackingNumber}` : ''
        ].filter(Boolean);
        const combinedNotes = notesList.join(' | ') || `Rif DDT N. ${docNumber}`;

        const isCOD = paymentName.toLowerCase().includes('contrassegno') || paymentName.toLowerCase().includes('cod');
        const codAmount = isCOD ? totalAmount : '';
        const codType = isCOD ? 'CONTANTI' : '';

        const { street, number } = splitAddress(originalAddress);
        const rowId = `row-${Date.now()}-${i}`;
        
        // Parse date from TransportDateTime or Date
        const parseTransportDate = (val: string): string => {
          if (!val) return '';
          // Try to extract YYYY-MM-DD
          const ymdMatch = val.match(/^(\d{4})[-/](\d{2})[-/](\d{2})/);
          if (ymdMatch) {
            return `${ymdMatch[1]}-${ymdMatch[2]}-${ymdMatch[3]}`;
          }
          // Try to extract DD/MM/YYYY
          const dmyMatch = val.match(/^(\d{2})[-/](\d{2})[-/](\d{4})/);
          if (dmyMatch) {
            return `${dmyMatch[3]}-${dmyMatch[2]}-${dmyMatch[1]}`;
          }
          return val;
        };
        const rawDate = transportDateTime || getTagValue('Date') || '';
        const formattedTransportDate = parseTransportDate(rawDate);
        
        // Intelligently parse multiple packages if colli > 1
        const colliNum = parseInt(colli || '1');
        const packagesList: { id: string; peso: string; larghezza: string; altezza: string; profondita: string; }[] = [];
        if (colliNum > 1) {
          const searchString = `${combinedNotes} ${deliveryNotes} ${internalComment} ${customField1} ${customField2} ${customField3} ${customField4}`.toLowerCase();
          const totalWeight = parseFloat((peso || '1.0').replace(',', '.'));
          const singleWeight = (!isNaN(totalWeight) && totalWeight > 0) ? (totalWeight / colliNum).toFixed(2) : '1.0';

          // Look for dimensions like 20x30x40 or 20*30*40
          const dimRegex = /(\d+)\s*[xX*]\s*(\d+)\s*[xX*]\s*(\d+)/g;
          const foundDims: {w: string, h: string, d: string}[] = [];
          let dMatch;
          while ((dMatch = dimRegex.exec(searchString)) !== null) {
            foundDims.push({ w: dMatch[1], h: dMatch[2], d: dMatch[3] });
          }

          // Look for weights like 5.5 kg or 5,5kg or 5kg
          const weightRegex = /(\d+(?:[.,]\d+)?)\s*kg/g;
          const foundWeights: string[] = [];
          let wMatch;
          while ((wMatch = weightRegex.exec(searchString)) !== null) {
            foundWeights.push(wMatch[1].replace(',', '.'));
          }

          for (let idx = 0; idx < colliNum; idx++) {
            const pWeight = foundWeights[idx] || singleWeight;
            const pDim = foundDims[idx] || {
              w: getTagValue('Width') || getTagValue('Larghezza') || '',
              h: getTagValue('Height') || getTagValue('Altezza') || '',
              d: getTagValue('Depth') || getTagValue('Profondita') || ''
            };

            packagesList.push({
              id: `pkg-${Date.now()}-${i}-${idx}`,
              peso: pWeight,
              larghezza: pDim.w || '10',
              altezza: pDim.h || '10',
              profondita: pDim.d || '10'
            });
          }
        }

        const partialRow: DestinationRow = {
          id: rowId,
          docNumber,
          recipientName,
          contattoDestinatarioRef: '',
          email,
          telefono,
          cellulare,
          via: street,
          civico: number,
          cap,
          localita,
          provincia: provincia.toUpperCase().substring(0, 2),
          country: country.toUpperCase() || 'IT',
          nazioneDestinatario: country.toUpperCase() === 'IT' ? 'ITALIA' : country,
          note: combinedNotes,
          
          ritiroName: '',
          ritiroContactRef: '',
          ritiroEmail: '',
          ritiroPhone: '',
          ritiroMobile: '',
          ritiroVia: '',
          ritiroCivic: '',
          ritiroCap: '',
          ritiroLocalita: '',
          ritiroProvincia: '',
          ritiroCountry: '',
          ritiroCountryName: '',
          ritiroNotes: '',

          idLdv: '',
          identificativoCollo: '',
          colli,
          peso,
          larghezza: '',
          altezza: '',
          profondita: '',
          packages: packagesList.length > 0 ? packagesList : undefined,
          ritiroVolumetrico: '',
          dataSpedizioneRitiro: formattedTransportDate,
          contenuto: goodsAppearance || 'Merci',
          barcodeServizio: '',

          importoContrassegno: codAmount,
          tipoPagamento: codType,
          importoCoperturaFull: '',
          codiceAndataRitorno: '',
          consegnaGiornoOrarioDefinitoProgrammata: '',
          noteFasceOrarie: '',
          valuta: 'EUR',
          frazionarioPuntoposte: '',
          nomeUfficioPostale: '',
          flagAscensore: '',
          mancataConsegna: 'RITORNO_AL_MITTENTE',
          destVicino: '',
          valoreSpedizione: '',
          addebitoOneri: '',
          tipoImballo: '',
          identificativoFiscale: fiscalCode,
          tipoContenuto: '',
          dataRichiestaConsegna: '',
          inizioFasciaOrariaConsegna: '',
          fineFasciaOrariaConsegna: '',

          validation: {
            nameError: false,
            addressError: false,
            civicWarning: false,
            capError: false,
            localitaError: false,
            provinciaError: false,
            genericCapError: false,
            pesoError: false,
            contrassegnoError: false,
            reverseError: false,
            accessoryError: false,
            hasErrors: false,
            hasWarnings: false,
            messages: [],
            warnings: []
          }
        };

        const { fixedRow, logs: rowLogs } = autoFixRow(partialRow);
        rows.push(fixedRow);
      }

      setParsedRows(rows);
    } catch (e) {
      console.error('Error parsing XML', e);
      alert('Errore durante la lettura del file XML. Assicurati che il formato sia corretto.');
    }
  };

  const handleFile = (file: File) => {
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      parseDaneaXml(text);
    };
    reader.readAsText(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const startEditing = (rowId: string, field: string, currentValue: string) => {
    setEditingRowId(rowId);
    setEditingField(field);
    setTempEditValue(currentValue);
  };

  const saveEdit = (rowId: string, field: keyof DestinationRow) => {
    setParsedRows(prev => prev.map(row => {
      if (row.id === rowId) {
        const updatedRow = { ...row, [field]: tempEditValue };
        updatedRow.validation = validateRow(updatedRow);
        return updatedRow;
      }
      return row;
    }));
    setEditingRowId(null);
    setEditingField(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent, rowId: string, field: keyof DestinationRow) => {
    if (e.key === 'Enter') {
      saveEdit(rowId, field);
    } else if (e.key === 'Escape') {
      setEditingRowId(null);
      setEditingField(null);
    }
  };

  const handleDeleteRow = (rowId: string) => {
    if (window.confirm('Rimuovere questa spedizione?')) {
      setParsedRows(prev => prev.filter(row => row.id !== rowId));
      if (expandedRowId === rowId) {
        setExpandedRowId(null);
      }
    }
  };

  const handleAddManualRow = () => {
    const rowId = `row-manual-${Date.now()}`;
    const newRow: DestinationRow = {
      id: rowId,
      docNumber: `MAN-${parsedRows.length + 1}`,
      recipientName: '',
      contattoDestinatarioRef: '',
      email: '',
      telefono: '',
      cellulare: '',
      via: '',
      civico: '',
      cap: '',
      localita: '',
      provincia: '',
      country: 'IT',
      nazioneDestinatario: 'ITALIA',
      note: 'Spedizione manuale',
      
      ritiroName: '',
      ritiroContactRef: '',
      ritiroEmail: '',
      ritiroPhone: '',
      ritiroMobile: '',
      ritiroVia: '',
      ritiroCivic: '',
      ritiroCap: '',
      ritiroLocalita: '',
      ritiroProvincia: '',
      ritiroCountry: '',
      ritiroCountryName: '',
      ritiroNotes: '',

      idLdv: '',
      identificativoCollo: '',
      colli: '1',
      peso: '1.0',
      larghezza: '',
      altezza: '',
      profondita: '',
      ritiroVolumetrico: '',
      dataSpedizioneRitiro: '',
      contenuto: '',
      barcodeServizio: '',

      importoContrassegno: '',
      tipoPagamento: '',
      importoCoperturaFull: '',
      codiceAndataRitorno: '',
      consegnaGiornoOrarioDefinitoProgrammata: '',
      noteFasceOrarie: '',
      valuta: 'EUR',
      frazionarioPuntoposte: '',
      nomeUfficioPostale: '',
      flagAscensore: '',
      mancataConsegna: 'RITORNO_AL_MITTENTE',
      destVicino: '',
      valoreSpedizione: '',
      addebitoOneri: '',
      tipoImballo: '',
      identificativoFiscale: '',
      tipoContenuto: '',
      dataRichiestaConsegna: '',
      inizioFasciaOrariaConsegna: '',
      fineFasciaOrariaConsegna: '',

      validation: {
        nameError: true,
        addressError: true,
        civicWarning: true,
        capError: true,
        localitaError: true,
        provinciaError: true,
        genericCapError: false,
        pesoError: true,
        contrassegnoError: false,
        reverseError: false,
        accessoryError: false,
        hasErrors: true,
        hasWarnings: true,
        messages: ["Nuova spedizione inserita manualmente, inserisci i dati obbligatori."],
        warnings: []
      }
    };
    setParsedRows(prev => [...prev, newRow]);
    setExpandedRowId(rowId); // automatically expand for easy configuration
  };

  const handleRowFieldChange = (rowId: string, field: keyof DestinationRow, value: string) => {
    setParsedRows(prev => prev.map(row => {
      if (row.id === rowId) {
        let updatedRow = { ...row, [field]: value };
        if (field === 'colli') {
          // If colli changes, we should auto-adjust or initialize the packages array
          const num = parseInt(value) || 1;
          const currentPkgs = row.packages || [];
          if (num > 1) {
            const pkgsList = [];
            const totalWeight = parseFloat((row.peso || '1.0').replace(',', '.'));
            const singleWeight = (!isNaN(totalWeight) && totalWeight > 0) ? (totalWeight / num).toFixed(2) : '1.0';
            for (let idx = 0; idx < num; idx++) {
              pkgsList.push(
                currentPkgs[idx] || {
                  id: `pkg-${Date.now()}-${idx}`,
                  peso: singleWeight,
                  larghezza: row.larghezza || '10',
                  altezza: row.altezza || '10',
                  profondita: row.profondita || '10'
                }
              );
            }
            updatedRow.packages = pkgsList;
          } else {
            updatedRow.packages = undefined;
          }
        }
        updatedRow.validation = validateRow(updatedRow);
        return updatedRow;
      }
      return row;
    }));
  };

  const handlePackageFieldChange = (rowId: string, pkgId: string, field: 'peso' | 'larghezza' | 'altezza' | 'profondita', value: string) => {
    setParsedRows(prev => prev.map(row => {
      if (row.id !== rowId) return row;
      const updatedPkgs = (row.packages || []).map(p => {
        if (p.id !== pkgId) return p;
        return { ...p, [field]: value };
      });
      
      const totalWeight = updatedPkgs.reduce((sum, p) => sum + parseFloat((p.peso || '0').replace(',', '.')), 0);
      
      const updatedRow = {
        ...row,
        packages: updatedPkgs,
        peso: totalWeight > 0 ? totalWeight.toFixed(2) : row.peso
      };
      
      updatedRow.validation = validateRow(updatedRow);
      return updatedRow;
    }));
  };

  const handleAddPackage = (rowId: string) => {
    setParsedRows(prev => prev.map(row => {
      if (row.id !== rowId) return row;
      const currentPkgs = row.packages || [];
      const newPkg = {
        id: `pkg-${Date.now()}-${currentPkgs.length}`,
        peso: '1.0',
        larghezza: row.larghezza || '10',
        altezza: row.altezza || '10',
        profondita: row.profondita || '10'
      };
      const updatedPkgs = [...currentPkgs, newPkg];
      const newColli = updatedPkgs.length.toString();
      const totalWeight = updatedPkgs.reduce((sum, p) => sum + parseFloat((p.peso || '0').replace(',', '.')), 0);
      
      const updatedRow = {
        ...row,
        colli: newColli,
        packages: updatedPkgs,
        peso: totalWeight > 0 ? totalWeight.toFixed(2) : row.peso
      };

      updatedRow.validation = validateRow(updatedRow);
      return updatedRow;
    }));
  };

  const handleRemovePackage = (rowId: string, pkgId: string) => {
    setParsedRows(prev => prev.map(row => {
      if (row.id !== rowId) return row;
      const currentPkgs = row.packages || [];
      if (currentPkgs.length <= 1) {
        alert("Una spedizione deve contenere almeno un collo. Per rimuovere l'intera riga, usa il pulsante di eliminazione.");
        return row;
      }
      const updatedPkgs = currentPkgs.filter(p => p.id !== pkgId);
      const newColli = updatedPkgs.length.toString();
      const totalWeight = updatedPkgs.reduce((sum, p) => sum + parseFloat((p.peso || '0').replace(',', '.')), 0);
      
      const updatedRow = {
        ...row,
        colli: newColli,
        packages: updatedPkgs,
        peso: totalWeight > 0 ? totalWeight.toFixed(2) : row.peso
      };

      updatedRow.validation = validateRow(updatedRow);
      return updatedRow;
    }));
  };

  const handleApplyDimensionsToAllPackages = (rowId: string) => {
    setParsedRows(prev => prev.map(row => {
      if (row.id !== rowId) return row;
      const currentPkgs = row.packages || [];
      if (currentPkgs.length === 0) return row;
      
      const mainL = row.larghezza || '10';
      const mainA = row.altezza || '10';
      const mainP = row.profondita || '10';
      
      const updatedPkgs = currentPkgs.map(p => ({
        ...p,
        larghezza: mainL,
        altezza: mainA,
        profondita: mainP
      }));
      
      const updatedRow = {
        ...row,
        packages: updatedPkgs
      };
      
      updatedRow.validation = validateRow(updatedRow);
      return updatedRow;
    }));
  };

  const handleAutoFixAll = () => {
    let totalFixes = 0;
    const allLogs: string[] = [];

    const updatedRows = parsedRows.map(row => {
      const { fixedRow, logs } = autoFixRow(row);
      if (logs.length > 0) {
        totalFixes += logs.length;
        allLogs.push(`DDT Ref: ${row.docNumber} (${row.recipientName || 'Senza nome'}):\n` + logs.map(l => `  - ${l}`).join('\n'));
      }
      return fixedRow;
    });

    if (totalFixes === 0) {
      alert("Nessun problema risolvibile automaticamente rilevato nelle spedizioni presenti.");
      return;
    }

    setParsedRows(updatedRows);
    alert(
      `RISOLUZIONE AUTOMATICA COMPLETATA!\n\n` +
      `Sono state apportate ${totalFixes} correzioni automatiche in totale su ${allLogs.length} spedizion${allLogs.length === 1 ? 'e' : 'i'}.\n\n` +
      `Esempi di correzioni applicate:\n\n` +
      allLogs.slice(0, 3).join('\n\n') +
      (allLogs.length > 3 ? `\n\n...e altre ${allLogs.length - 3} spedizioni ottimizzate automaticamente.` : '')
    );
  };

  const isConfigValid = (): boolean => {
    if (selectedCarrier === 'gls') return true;
    const isGenericCap = (c: string): boolean => /^\d{3}00$/.test(c.trim());
    const isCapValid = /^\d{5}$/.test(config.senderCap?.trim() || '');
    
    const senderCap = config.senderCap?.trim() || '';
    const isGeneric = isGenericCap(senderCap);
    const isSenderCapOk = isCapValid && (!isGeneric || checkIsProvinceCapital(config.senderLocalita || '', config.senderProvincia || ''));

    return !!(
      config.contractCode &&
      config.costCenter &&
      config.senderName &&
      config.senderVia &&
      config.senderCap &&
      isSenderCapOk &&
      config.senderLocalita &&
      config.senderProvincia &&
      config.senderPhone &&
      config.senderEmail &&
      config.productType
    );
  };

  const errorCount = parsedRows.filter(r => r.validation.hasErrors).length;
  const warningCount = parsedRows.filter(r => r.validation.hasWarnings && !r.validation.hasErrors).length;
  const isExportReady = parsedRows.length > 0 && errorCount === 0 && isConfigValid();

  const generateCSV = () => {
    const rowErrors = parsedRows.filter(r => r.validation.hasErrors);
    if (rowErrors.length > 0) {
      const sampleErrors = rowErrors.slice(0, 3).map((r, i) => {
        const dest = r.recipientName || `Spedizione #${i + 1}`;
        const errs = r.validation.messages.join(', ');
        return `- ${dest}: ${errs}`;
      }).join('\n');

      const totalErrors = rowErrors.length;
      alert(
        `CONTROLLO INTEGRITÀ FALLITO!\n\n` +
        `Impossibile esportare il file CSV. Rilevati errori bloccanti su ${totalErrors} spedizion${totalErrors === 1 ? 'e' : 'i'}.\n\n` +
        `Dettaglio dei primi errori riscontrati:\n${sampleErrors}\n\n` +
        `Per favore, correggi i CAP generici, i pesi o altri dati obbligatori prima di procedere.`
      );
      return;
    }

    if (!isConfigValid()) {
      const missingFields: string[] = [];
      if (!config.contractCode) missingFields.push("Codice Contratto");
      if (!config.costCenter) missingFields.push("Centro Costo");
      if (!config.senderName) missingFields.push("Ragione Sociale Mittente");
      if (!config.senderVia) missingFields.push("Indirizzo Mittente (Via)");
      if (!config.senderCap) missingFields.push("CAP Mittente");
      else if (!/^\d{5}$/.test(config.senderCap.trim())) missingFields.push("CAP Mittente (deve essere di 5 cifre)");
      else if (/^\d{3}00$/.test(config.senderCap.trim())) {
        const isCapoluogo = checkIsProvinceCapital(config.senderLocalita || '', config.senderProvincia || '');
        if (!isCapoluogo) {
          missingFields.push("CAP Mittente (CAP generico non valido per la località inserita)");
        }
      }
      if (!config.senderLocalita) missingFields.push("Località Mittente");
      if (!config.senderProvincia) missingFields.push("Provincia Mittente");
      if (!config.senderPhone) missingFields.push("Telefono Mittente");
      if (!config.senderEmail) missingFields.push("Email Mittente");
      if (!config.productType) missingFields.push("Tipo Prodotto");

      alert(
        `CONTROLLO INTEGRITÀ MITTENTE FALLITO!\n\n` +
        `I seguenti campi obbligatori del Mittente sono mancanti o non validi:\n` +
        missingFields.map(f => `- ${f}`).join('\n') + `\n\n` +
        `Completa tutti i dati della Configurazione Mittente a sinistra prima di esportare.`
      );
      return;
    }

    // Double check just in case
    if (parsedRows.length === 0) return;

    // Exact 76 headers from requested template
    const headers = [
      'CHANNEL',
      'CODICE_CONTRATTO',
      'CENTRO_COSTO',
      'CODICE_IDENTIFICATIVO_CLIENTE',
      'PRODOTTO',
      'COGNOME_RAGSOC_MITTENTE',
      'CONTATTO_MITTENTE_REF',
      'EMAIL_MITTENTE',
      'NUMERO_TELEFONO_MITTENTE',
      'NUMERO_CELLULARE_MITTENTE',
      'VIA_MITTENTE',
      'NUMERO_CIVICO_MITTENTE',
      'CAP_MITTENTE',
      'LOCALITA_MITTENTE',
      'PROVINCIA_MITTENTE',
      'CODICE_NAZIONE_MITTENTE',
      'NAZIONE_MITTENTE',
      'NOTE1_MITTENTE',
      'COGNOME_RAGSOC_DESTINATARIO',
      'CONTATTO_DESTINATARIO_REF',
      'EMAIL_DESTINATARIO',
      'NUMERO_TELEFONO_DESTINATARIO',
      'NUMERO_CELLULARE_DESTINATARIO',
      'VIA_DESTINATARIO',
      'NUMERO_CIVICO_DESTINATARIO',
      'CAP_DESTINATARIO',
      'LOCALITA_DESTINATARIO',
      'PROVINCIA_DESTINATARIO',
      'CODICE_NAZIONE_DESTINATARIO',
      'NAZIONE_DESTINATARIO',
      'NOTE1_DESTINATARIO',
      'COGNOME_RAGSOC_RITIRO',
      'CONTATTO_RITIRO_REF',
      'EMAIL_RITIRO',
      'NUMERO_TELEFONO_RITIRO',
      'NUMERO_CELLULARE_RITIRO',
      'VIA_RITIRO',
      'NUMERO_CIVICO_RITIRO',
      'CAP_RITIRO',
      'LOCALITA_RITIRO',
      'PROVINCIA_RITIRO',
      'CODICE_NAZIONE_RITIRO',
      'NAZIONE_RITIRO',
      'NOTE1_RITIRO',
      'ID_LDV',
      'NUMERO_RIFERIMENTO_SPEDIZIONE',
      'IDENTIFICATIVO_COLLO',
      'NUMERO_COLLI',
      'PESO_COLLO',
      'LARGHEZZA',
      'ALTEZZA',
      'PROFONDITA',
      'RITIRO_VOLUMETRICO',
      'DATA_SPEDIZIONE_RITIRO',
      'CONTENUTO',
      'BARCODE_SERVIZIO',
      'IMPORTO_CONTRASSEGNO',
      'TIPO_PAGAMENTO(*)',
      'IMPORTO_COPERTURA_FULL',
      'CODICE_ANDATA_RITORNO',
      'CONSEGNA_GIORNO_ORARIO_DEFINITO_PROGRAMMATA',
      'NOTE_FASCE_ORARIE',
      'VALUTA',
      'FRAZIONARIO_PUNTOPOSTE',
      'NOME_UFFICIO_POSTALE',
      'FLAG_ASCENSORE',
      'MANCATA_CONSEGNA',
      'DEST_VICINO',
      'VALORE_SPEDIZIONE',
      'ADDEBITO_ONERI',
      'TIPO_IMBALLO',
      'IDENTIFICATIVO_FISCALE',
      'TIPO_CONTENUTO',
      'DATA_RICHIESTA_CONSEGNA',
      'INIZIO_FASCIA_ORARIA_CONSEGNA',
      'FINE_FASCIA_ORARIA_CONSEGNA'
    ];

    const csvRows = [headers.join(';')];

    parsedRows.forEach(row => {
      const clean = (val: string | null | undefined, maxLen?: number, removeCommas: boolean = false): string => {
        if (!val) return '';
        let cleaned = val.toString().replace(/;/g, ' ').replace(/\r?\n|\r/g, ' ');
        if (removeCommas) {
          cleaned = cleaned.replace(/,/g, ' ');
        }
        cleaned = cleaned.trim();
        if (maxLen && cleaned.length > maxLen) {
          cleaned = cleaned.substring(0, maxLen);
        }
        return cleaned;
      };

      const getProductCode = (type: string | null | undefined): string => {
        const t = (type || '').toLowerCase();
        if (t.includes('express') || t === 'apt000901') {
          return 'APT000901';
        }
        return 'APT000902'; // default standard
      };

      const getWeightInGrams = (pesoStr: string | null | undefined): string => {
        if (!pesoStr) return '1000';
        const cleanPeso = pesoStr.toString().replace(',', '.').trim();
        const num = parseFloat(cleanPeso);
        if (isNaN(num) || num <= 0) return '1000';
        return Math.round(num * 1000).toString();
      };

      const getFormattedDate = (dateStr?: string): string => {
        if (dateStr) {
          const cleanDate = dateStr.trim().replace(/[-/.]/g, '');
          if (cleanDate.length === 8 && /^\d+$/.test(cleanDate)) return cleanDate;
        }
        
        let d = new Date();
        if (dateStr) {
          const parsed = Date.parse(dateStr);
          if (!isNaN(parsed)) {
            d = new Date(parsed);
          }
        }
        
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${yyyy}${mm}${dd}`;
      };

      const getImportoContrassegno = (val: string | null | undefined): string => {
        if (!val) return '';
        const cleanVal = val.toString().replace(',', '.').replace(/[^\d.]/g, '');
        const num = parseFloat(cleanVal);
        if (isNaN(num) || num <= 0) return '';
        return num.toFixed(2);
      };

      const getTipoPagamento = (val: string | null | undefined, contrassegnoVal: string | null | undefined): string => {
        const hasContrassegno = parseFloat((contrassegnoVal || '').toString().replace(',', '.')) > 0;
        if (!hasContrassegno) return '';
        
        const v = (val || '').toString().trim().toUpperCase();
        if (v.includes('CON') || v === 'CONTANTI') return 'CON';
        if (v.includes('ACM') || v.includes('CIRC') || v.includes('POST')) return 'ACM';
        if (v.includes('ABM') || v.includes('BANC')) return 'ABM';
        return 'CON'; // default to cash if contrassegno exists
      };

      const getFormattedCurrency = (val: string | null | undefined): string => {
        if (!val) return '';
        const cleanVal = val.toString().replace(',', '.').replace(/[^\d.]/g, '');
        const num = parseFloat(cleanVal);
        if (isNaN(num) || num <= 0) return '';
        return num.toFixed(2);
      };

      const getMancataConsegna = (val: string | null | undefined): string => {
        const v = (val || '').toString().trim().toUpperCase();
        if (v.includes('RIT') || v === 'R' || v.includes('MITTENTE')) return 'R';
        if (v.includes('ABB') || v === 'A' || v.includes('ABANDON')) return 'A';
        return 'R'; // default to Restituire
      };

      const colliNum = parseInt(row.colli || '1');
      let pkgsToProcess: { peso: string; larghezza: string; altezza: string; profondita: string; index: number }[] = [];
      
      if (colliNum > 1) {
        if (row.packages && row.packages.length > 0) {
          pkgsToProcess = row.packages.map((p, idx) => ({
            peso: p.peso,
            larghezza: p.larghezza,
            altezza: p.altezza,
            profondita: p.profondita,
            index: idx
          }));
        } else {
          const totalWeight = parseFloat((row.peso || '1').toString().replace(',', '.'));
          const singleWeight = (isNaN(totalWeight) || totalWeight <= 0) ? '1.0' : (totalWeight / colliNum).toFixed(2);
          for (let idx = 0; idx < colliNum; idx++) {
            pkgsToProcess.push({
              peso: singleWeight,
              larghezza: row.larghezza || '10',
              altezza: row.altezza || '10',
              profondita: row.profondita || '10',
              index: idx
            });
          }
        }
      } else {
        pkgsToProcess = [{
          peso: row.peso,
          larghezza: row.larghezza,
          altezza: row.altezza,
          profondita: row.profondita,
          index: 0
        }];
      }

      // Pre-check multi-colli option (APT000945)
      let barcodes = (row.barcodeServizio || '').split('|').map(s => s.trim().toUpperCase()).filter(Boolean);
      if (colliNum > 1 && !barcodes.includes('APT000945')) {
        barcodes.push('APT000945');
      }
      const activeBarcodeServizio = barcodes.join('|');

      pkgsToProcess.forEach(pkg => {
        const csvRow = [
          /* 1 CHANNEL Y Char 13: Inserire sempre STAMPAMASSIVA */
          clean('STAMPAMASSIVA', 13),
          
          /* 2 CODICE_CONTRATTO Y Char 12 */
          clean(config.contractCode, 12),
          
          /* 3 CENTRO_COSTO Y Char 20 */
          clean(config.costCenter, 20),
          
          /* 4 CODICE_IDENTIFICATIVO_CLIENTE Y Char 12 */
          clean(config.clientIdentifier, 12),
          
          /* 5 PRODOTTO Y Char 9 */
          clean(getProductCode(config.productType), 9),
          
          /* 6 COGNOME_RAGSOC_MITTENTE Y Char 35 */
          clean(config.senderName, 35),
          
          /* 7 CONTATTO_MITTENTE_REF N Char 35 */
          clean(config.senderContactRef, 35),
          
          /* 8 EMAIL_MITTENTE N Char 50 */
          clean(config.senderEmail, 50),
          
          /* 9 NUMERO_TELEFONO_MITTENTE N Char 15 */
          clean(config.senderPhone, 15),
          
          /* 10 NUMERO_CELLULARE_MITTENTE N Char 15 */
          clean(config.senderMobile, 15),
          
          /* 11 VIA_MITTENTE Y Char 40 */
          clean(config.senderVia, 40, true),
          
          /* 12 NUMERO_CIVICO_MITTENTE Y Char 4 */
          clean(config.senderCivic, 4),
          
          /* 13 CAP_MITTENTE Y Char 7 */
          clean(config.senderCap, 7),
          
          /* 14 LOCALITA_MITTENTE Y Char 30 */
          clean(config.senderLocalita, 30),
          
          /* 15 PROVINCIA_MITTENTE Y Char 2 */
          clean(config.senderProvincia?.toUpperCase(), 2),
          
          /* 16 CODICE_NAZIONE_MITTENTE Y Char 4: Valore Fisso, inserire sempre ITA1 */
          'ITA1',
          
          /* 17 NAZIONE_MITTENTE Y Char 30: sempre ITALIA */
          'ITALIA',
          
          /* 18 NOTE1_MITTENTE N Char 30 */
          clean(config.senderNotes, 30),
          
          /* 19 COGNOME_RAGSOC_DESTINATARIO Y Char 35 */
          clean(row.recipientName, 35),
          
          /* 20 CONTATTO_DESTINATARIO_REF N Char 35 */
          clean(row.contattoDestinatarioRef, 35),
          
          /* 21 EMAIL_DESTINATARIO N Char 50 */
          clean(row.email, 50),
          
          /* 22 NUMERO_TELEFONO_DESTINATARIO N Char 15 */
          clean(row.telefono, 15),
          
          /* 23 NUMERO_CELLULARE_DESTINATARIO N Char 15 */
          clean(row.cellulare, 15),
          
          /* 24 VIA_DESTINATARIO Y Char 40 */
          clean(row.via, 40, true),
          
          /* 25 NUMERO_CIVICO_DESTINATARIO Y Char 4 */
          clean(row.civico, 4),
          
          /* 26 CAP_DESTINATARIO Y Char 7 */
          clean(row.cap, 7),
          
          /* 27 LOCALITA_DESTINATARIO Y Char 30 */
          clean(row.localita, 30),
          
          /* 28 PROVINCIA_DESTINATARIO Y Char 2 */
          clean(row.provincia?.toUpperCase(), 2),
          
          /* 29 CODICE_NAZIONE_DESTINATARIO Y Char 4: Valore Fisso. Inserire sempre ITA1. */
          'ITA1',
          
          /* 30 NAZIONE_DESTINATARIO Y Char 30: Valore Fisso. Inserire sempre ITALIA */
          'ITALIA',
          
          /* 31 NOTE1_DESTINATARIO N Char 30 */
          clean(row.note, 30),
          
          /* 32 to 44: Indirizzi ritiro, "Campo da non valorizzare." */
          /* 32 COGNOME_RAGSOC_RITIRO */ '',
          /* 33 CONTATTO_RITIRO_REF */ '',
          /* 34 EMAIL_RITIRO */ '',
          /* 35 NUMERO_TELEFONO_RITIRO */ '',
          /* 36 NUMERO_CELLULARE_RITIRO */ '',
          /* 37 VIA_RITIRO */ '',
          /* 38 NUMERO_CIVICO_RITIRO */ '',
          /* 39 CAP_RITIRO */ '',
          /* 40 LOCALITA_RITIRO */ '',
          /* 41 PROVINCIA_RITIRO */ '',
          /* 42 CODICE_NAZIONE_RITIRO */ '',
          /* 43 NAZIONE_RITIRO */ '',
          /* 44 NOTE1_RITIRO */ '',
          
          /* 45 ID_LDV N Char 30: Da non valorizzare */
          '',
          
          /* 46 NUMERO_RIFERIMENTO_SPEDIZIONE Y Char 25 */
          clean(row.docNumber, 25),
          
          /* 47 IDENTIFICATIVO_COLLO Y Char 25 */
          clean(row.identificativoCollo || (row.docNumber ? `${row.docNumber}_${pkg.index + 1}` : `COLLO_${row.id}_${pkg.index + 1}`), 25),
          
          /* 48 NUMERO_COLLI Y Char 3 */
          clean(colliNum.toString(), 3),
          
          /* 49 PESO_COLLO Y Char 7: espresso in grammi */
          clean(getWeightInGrams(pkg.peso), 7),
          
          /* 50 LARGHEZZA Y Char 5 */
          clean(pkg.larghezza || '10', 5),
          
          /* 51 ALTEZZA Y Char 5 */
          clean(pkg.altezza || '10', 5),
          
          /* 52 PROFONDITA Y Char 5 */
          clean(pkg.profondita || '10', 5),
          
          /* 53 RITIRO_VOLUMETRICO N Char 1: Da non valorizzare */
          '',
          
          /* 54 DATA_SPEDIZIONE_RITIRO Y Char 8: data spedizione AAAAMMGG */
          clean(getFormattedDate(row.dataSpedizioneRitiro), 8),
          
          /* 55 CONTENUTO N Char 30 */
          clean(row.contenuto || 'Merci', 30),
          
          /* 56 BARCODE_SERVIZIO N Char 200 */
          clean(activeBarcodeServizio, 200),
          
          /* 57 IMPORTO_CONTRASSEGNO Y/N Char 9: separatore '.' */
          clean(getImportoContrassegno(row.importoContrassegno), 9),
          
          /* 58 TIPO_PAGAMENTO(*) Y/N Char 3: CON, ACM, ABM se contrassegno */
          clean(getTipoPagamento(row.tipoPagamento, row.importoContrassegno), 3),
          
          /* 59 IMPORTO_COPERTURA_FULL Y/N Char 10: separatore '.' */
          clean(getFormattedCurrency(row.importoCoperturaFull), 10),
          
          /* 60 CODICE_ANDATA_RITORNO Y/N Char 25 */
          clean(row.codiceAndataRitorno, 25),
          
          /* 61 CONSEGNA_GIORNO_ORA_RIO_DEFI_NITO_PRO_GRAMMATA Y/N Char 6 */
          clean(row.consegnaGiornoOrarioDefinitoProgrammata, 6),
          
          /* 62 NOTE_FA_SCE_ORARIE Y/N Char 50 */
          clean(row.noteFasceOrarie, 50),
          
          /* 63 VALUTA Y/N Char 2: Costante EU per contrassegno/copertura */
          (getImportoContrassegno(row.importoContrassegno) || getFormattedCurrency(row.importoCoperturaFull)) ? 'EU' : '',
          
          /* 64 FRAZIONARIO_PUNTOPOSTE Y/N Char 11 */
          clean(row.frazionarioPuntoposte, 11),
          
          /* 65 NOME_UFFICIO_POSTALE N Char 50 */
          clean(row.nomeUfficioPostale, 50),
          
          /* 66 FLAG_ASCENSORE N Char 1 */
          clean(row.flagAscensore, 1),
          
          /* 67 MANCATA_CONSEGNA Y/N Char 1: R o A */
          clean(getMancataConsegna(row.mancataConsegna), 1),
          
          /* 68 DEST_VICINO Y/N Char 80 */
          clean(row.destVicino, 80),
          
          /* 69 to 73: Campi Internazionali, "Da non valorizzare." */
          /* 69 VALORE_SPEDIZIONE */ '',
          /* 70 ADDEBITO_ONERI */ '',
          /* 71 TIPO_IMBALLO */ '',
          /* 72 IDENTIFICATIVO_FISCALE */ '',
          /* 73 TIPO_CONTENUTO */ '',
          
          /* 74 DATA_RICHIESTA_CONSEGNA Y/N Char 8 */
          clean(row.dataRichiestaConsegna, 8),
          
          /* 75 INIZIO_FASCIA_ORARIA_CONSEGNA Y/N Char 5 */
          clean(row.inizioFasciaOrariaConsegna, 5),
          
          /* 76 FINE_FASCIA_ORARIA_CONSEGNA Y/N Char 5 */
          clean(row.fineFasciaOrariaConsegna, 5)
        ];

        csvRows.push(csvRow.join(';'));
      });
    });

    const csvContent = "\uFEFF" + csvRows.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    
    const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const cleanFileName = `spedizioni_poste_${timestamp}.csv`;
    
    link.setAttribute("href", url);
    link.setAttribute("download", cleanFileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#E5E7EB] pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-[#5A5A40]/10 rounded-2xl flex items-center justify-center text-[#5A5A40] shadow-sm">
              <FileCode size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-serif font-bold text-[#111827]">Generazione Spedizioni</h1>
              <p className="text-xs text-[#6B7280]">Elabora i tuoi DDT Danea XML, correggi gli indirizzi ed esporta i file pronti per il tuo corriere</p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-xl border border-emerald-100">
            <ShieldCheck size={14} />
            Privacy Totale: 100% Client-Side
          </div>
        </div>
      </div>

      {/* Carrier Selector */}
      <div className="bg-white p-6 rounded-3xl border border-[#E5E7EB] shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Truck className="text-[#5A5A40]" size={18} />
            <h3 className="font-serif font-bold text-base text-[#111827]">Vettore di Spedizione</h3>
          </div>
          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Passo 1: Scegli il corriere</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Poste Italiane option */}
          <button
            type="button"
            onClick={() => setSelectedCarrier('poste')}
            className={cn(
              "p-4 rounded-2xl border text-left transition-all relative overflow-hidden flex items-start gap-4 cursor-pointer",
              selectedCarrier === 'poste'
                ? "border-[#5A5A40] bg-[#5A5A40]/5 ring-2 ring-[#5A5A40]/20"
                : "border-gray-200 hover:border-gray-300 bg-white"
            )}
          >
            <div className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs shrink-0",
              selectedCarrier === 'poste' ? "bg-[#5A5A40] text-white" : "bg-gray-100 text-gray-500"
            )}>
              PI
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h4 className="font-serif font-black text-sm text-[#111827]">Poste Italiane</h4>
                <span className="text-[8px] font-black uppercase tracking-wider px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full">
                  Attivo
                </span>
              </div>
              <p className="text-[11px] text-[#6B7280] leading-relaxed">
                Genera il tracciato CSV conforme a 76 colonne per Poste Delivery Business.
              </p>
            </div>
          </button>

          {/* GLS option */}
          <button
            type="button"
            onClick={() => setSelectedCarrier('gls')}
            className={cn(
              "p-4 rounded-2xl border text-left transition-all relative overflow-hidden flex items-start gap-4 cursor-pointer",
              selectedCarrier === 'gls'
                ? "border-amber-500 bg-amber-500/5 ring-2 ring-amber-500/20"
                : "border-gray-200 hover:border-gray-300 bg-white"
            )}
          >
            <div className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs shrink-0",
              selectedCarrier === 'gls' ? "bg-amber-600 text-white" : "bg-gray-100 text-gray-500"
            )}>
              GLS
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h4 className="font-serif font-black text-sm text-[#111827]">GLS Italia</h4>
                <span className="text-[8px] font-black uppercase tracking-wider px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded-full">
                  Configurazione
                </span>
              </div>
              <p className="text-[11px] text-[#6B7280] leading-relaxed">
                Mappatura campi pronta. Tracciato di esportazione CSV/XLS in attesa di specifiche definitive.
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* Main Grid: Config + Drag&Drop */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Config Sender (Dati Fissi) */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-3xl border border-[#E5E7EB] shadow-sm overflow-hidden">
            <div className="p-6 border-b border-[#F3F4F6] bg-[#F9FAFB]/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Save className="text-[#5A5A40]" size={18} />
                <h3 className="font-serif font-bold text-base text-[#111827]">Configurazione Mittente</h3>
              </div>
              <span className="text-[10px] uppercase tracking-wider text-[#5A5A40] font-bold bg-[#5A5A40]/10 px-2.5 py-0.5 rounded-full">Dati Fissi</span>
            </div>

            {selectedCarrier === 'poste' ? (
              <form onSubmit={handleSaveConfig} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-[11px] font-bold text-[#4B5563] uppercase tracking-wider mb-1">Codice Contratto *</label>
                    <input 
                      type="text" 
                      required
                      value={config.contractCode}
                      onChange={(e) => handleConfigChange('contractCode', e.target.value)}
                      placeholder="Es. 12345678"
                      className="w-full bg-white border border-[#E5E7EB] rounded-xl px-3.5 py-2 text-xs outline-none focus:border-[#5A5A40] text-[#111827] font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[#4B5563] uppercase tracking-wider mb-1">Centro di Costo *</label>
                    <input 
                      type="text" 
                      required
                      value={config.costCenter}
                      onChange={(e) => handleConfigChange('costCenter', e.target.value)}
                      placeholder="Es. CDC01"
                      className="w-full bg-white border border-[#E5E7EB] rounded-xl px-3.5 py-2 text-xs outline-none focus:border-[#5A5A40] text-[#111827]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[#4B5563] uppercase tracking-wider mb-1">Prodotto *</label>
                    <select 
                      value={config.productType}
                      onChange={(e) => handleConfigChange('productType', e.target.value)}
                      className="w-full bg-white border border-[#E5E7EB] rounded-xl px-3.5 py-2 text-xs outline-none focus:border-[#5A5A40] text-[#111827] font-medium"
                    >
                      <option value="Poste Delivery Business">Poste Delivery Business</option>
                      <option value="Poste Delivery Business Express">Poste Delivery Business Express</option>
                      <option value="Poste Delivery Business Standard">Poste Delivery Standard</option>
                    </select>
                  </div>
                </div>

                <div className="border-t border-[#F3F4F6] pt-4 space-y-4">
                  <div>
                    <label className="block text-[11px] font-bold text-[#4B5563] uppercase tracking-wider mb-1">Nome Mittente / Rag. Sociale *</label>
                    <input 
                      type="text" 
                      required
                      value={config.senderName}
                      onChange={(e) => handleConfigChange('senderName', e.target.value)}
                      placeholder="Es. Connect Srl"
                      className="w-full bg-white border border-[#E5E7EB] rounded-xl px-3.5 py-2 text-xs outline-none focus:border-[#5A5A40] text-[#111827]"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2">
                      <label className="block text-[11px] font-bold text-[#4B5563] uppercase tracking-wider mb-1">Via Mittente *</label>
                      <input 
                        type="text" 
                        required
                        value={config.senderVia}
                        onChange={(e) => handleConfigChange('senderVia', e.target.value)}
                        placeholder="Es. Via dei Mille"
                        className="w-full bg-white border border-[#E5E7EB] rounded-xl px-3.5 py-2 text-xs outline-none focus:border-[#5A5A40] text-[#111827]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-[#4B5563] uppercase tracking-wider mb-1">Civico</label>
                      <input 
                        type="text" 
                        value={config.senderCivic}
                        onChange={(e) => handleConfigChange('senderCivic', e.target.value)}
                        placeholder="Es. 12"
                        className="w-full bg-white border border-[#E5E7EB] rounded-xl px-3.5 py-2 text-xs outline-none focus:border-[#5A5A40] text-[#111827]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-[#4B5563] uppercase tracking-wider mb-1">CAP *</label>
                      <input 
                        type="text" 
                        required
                        maxLength={5}
                        value={config.senderCap}
                        onChange={(e) => handleConfigChange('senderCap', e.target.value)}
                        placeholder="Es. 00159"
                        className={cn(
                          "w-full bg-white border rounded-xl px-3.5 py-2 text-xs outline-none text-[#111827]",
                          (config.senderCap && (!/^\d{5}$/.test(config.senderCap) || /^\d{3}00$/.test(config.senderCap)))
                            ? "border-rose-400 focus:border-rose-600 bg-rose-50/10"
                            : "border-[#E5E7EB] focus:border-[#5A5A40]"
                        )}
                      />
                      {config.senderCap && /^\d{3}00$/.test(config.senderCap) && (
                        <p className="text-[10px] text-rose-600 font-bold mt-1 leading-tight">
                          CAP generico vietato per città multi-CAP (es. Roma 00100). Usa il CAP specifico.
                        </p>
                      )}
                      {config.senderCap && !/^\d{5}$/.test(config.senderCap) && (
                        <p className="text-[10px] text-rose-600 font-bold mt-1 leading-tight">
                          Deve contenere 5 cifre.
                        </p>
                      )}
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[11px] font-bold text-[#4B5563] uppercase tracking-wider mb-1">Città / Località *</label>
                      <input 
                        type="text" 
                        required
                        value={config.senderLocalita}
                        onChange={(e) => handleConfigChange('senderLocalita', e.target.value)}
                        placeholder="Es. Roma"
                        className="w-full bg-white border border-[#E5E7EB] rounded-xl px-3.5 py-2 text-xs outline-none focus:border-[#5A5A40] text-[#111827]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-[#4B5563] uppercase tracking-wider mb-1">Provincia *</label>
                      <input 
                        type="text" 
                        required
                        maxLength={2}
                        value={config.senderProvincia}
                        onChange={(e) => handleConfigChange('senderProvincia', e.target.value.toUpperCase())}
                        placeholder="RM"
                        className="w-full bg-white border border-[#E5E7EB] rounded-xl px-3.5 py-2 text-xs outline-none focus:border-[#5A5A40] text-[#111827]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-[#4B5563] uppercase tracking-wider mb-1">Cod. Nazione *</label>
                      <input 
                        type="text" 
                        required
                        value={config.senderCountryCode}
                        onChange={(e) => handleConfigChange('senderCountryCode', e.target.value.toUpperCase())}
                        placeholder="IT"
                        className="w-full bg-white border border-[#E5E7EB] rounded-xl px-3.5 py-2 text-xs outline-none focus:border-[#5A5A40] text-[#111827]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className="block text-[11px] font-bold text-[#4B5563] uppercase tracking-wider mb-1">Telefono *</label>
                      <input 
                        type="text" 
                        required
                        value={config.senderPhone}
                        onChange={(e) => handleConfigChange('senderPhone', e.target.value)}
                        placeholder="Es. 06123456"
                        className="w-full bg-white border border-[#E5E7EB] rounded-xl px-3.5 py-2 text-xs outline-none focus:border-[#5A5A40] text-[#111827]"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[11px] font-bold text-[#4B5563] uppercase tracking-wider mb-1">Email *</label>
                      <input 
                        type="email" 
                        required
                        value={config.senderEmail}
                        onChange={(e) => handleConfigChange('senderEmail', e.target.value)}
                        placeholder="Es. info@connect.it"
                        className="w-full bg-white border border-[#E5E7EB] rounded-xl px-3.5 py-2 text-xs outline-none focus:border-[#5A5A40] text-[#111827]"
                      />
                    </div>
                  </div>

                  {/* Collapsible details for Advanced Sender Fields */}
                  <details className="group border-t border-[#F3F4F6] pt-4">
                    <summary className="flex items-center justify-between text-xs font-bold text-[#5A5A40] cursor-pointer list-none select-none">
                      <span>Campi Mittente Avanzati</span>
                      <span className="transition-transform group-open:rotate-180">
                        <ChevronDown size={14} />
                      </span>
                    </summary>
                    
                    <div className="mt-4 space-y-4 pt-1">
                      <div>
                        <label className="block text-[10px] font-bold text-[#6B7280] uppercase tracking-wider mb-1">Channel (Default POSTE)</label>
                        <input 
                          type="text" 
                          value={config.channel}
                          onChange={(e) => handleConfigChange('channel', e.target.value)}
                          placeholder="POSTE"
                          className="w-full bg-white border border-[#E5E7EB] rounded-xl px-3.5 py-2 text-xs outline-none focus:border-[#5A5A40] text-[#111827]"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-[#6B7280] uppercase tracking-wider mb-1">Codice Identificativo Cliente</label>
                        <input 
                          type="text" 
                          value={config.clientIdentifier}
                          onChange={(e) => handleConfigChange('clientIdentifier', e.target.value)}
                          placeholder="Es. COD123"
                          className="w-full bg-white border border-[#E5E7EB] rounded-xl px-3.5 py-2 text-xs outline-none focus:border-[#5A5A40] text-[#111827]"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-[#6B7280] uppercase tracking-wider mb-1">Referente / Contatto Mittente</label>
                        <input 
                          type="text" 
                          value={config.senderContactRef}
                          onChange={(e) => handleConfigChange('senderContactRef', e.target.value)}
                          placeholder="Es. Reparto Spedizioni"
                          className="w-full bg-white border border-[#E5E7EB] rounded-xl px-3.5 py-2 text-xs outline-none focus:border-[#5A5A40] text-[#111827]"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-[#6B7280] uppercase tracking-wider mb-1">Cellulare Mittente</label>
                        <input 
                          type="text" 
                          value={config.senderMobile}
                          onChange={(e) => handleConfigChange('senderMobile', e.target.value)}
                          placeholder="Es. 3330000000"
                          className="w-full bg-white border border-[#E5E7EB] rounded-xl px-3.5 py-2 text-xs outline-none focus:border-[#5A5A40] text-[#111827]"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-[#6B7280] uppercase tracking-wider mb-1">Nazione Mittente (Completa)</label>
                        <input 
                          type="text" 
                          value={config.senderCountryName}
                          onChange={(e) => handleConfigChange('senderCountryName', e.target.value)}
                          placeholder="Es. ITALIA"
                          className="w-full bg-white border border-[#E5E7EB] rounded-xl px-3.5 py-2 text-xs outline-none focus:border-[#5A5A40] text-[#111827]"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-[#6B7280] uppercase tracking-wider mb-1">Note Mittente (Note1_Mittente)</label>
                        <input 
                          type="text" 
                          value={config.senderNotes}
                          onChange={(e) => handleConfigChange('senderNotes', e.target.value)}
                          placeholder="Note libere"
                          className="w-full bg-white border border-[#E5E7EB] rounded-xl px-3.5 py-2 text-xs outline-none focus:border-[#5A5A40] text-[#111827]"
                        />
                      </div>
                    </div>
                  </details>
                </div>

                <button
                  type="submit"
                  className={cn(
                    "w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 cursor-pointer",
                    isSaved 
                      ? "bg-emerald-600 text-white" 
                      : "bg-[#5A5A40] hover:bg-[#4A4A30] text-white"
                  )}
                >
                  {isSaved ? (
                    <>
                      <CheckCircle2 size={16} />
                      Configurazione Salvata!
                    </>
                  ) : (
                    <>
                      <Save size={16} />
                      Salva nel Browser
                    </>
                  )}
                </button>
              </form>
            ) : (
              <div className="p-6 space-y-5">
                <div className="p-4 bg-amber-500/10 rounded-2xl border border-amber-500/10 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center text-amber-900 shrink-0 mt-0.5">
                    <Truck size={15} />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-xs font-black text-amber-950 uppercase tracking-wider">Gestito da GLS</h4>
                    <p className="text-[11px] text-amber-900 leading-relaxed font-semibold">
                      Mittente automatico nel portale GLS
                    </p>
                  </div>
                </div>

                <div className="space-y-4 text-xs text-gray-600 leading-relaxed">
                  <p className="font-bold text-gray-800">Perché non serve configurare il mittente?</p>
                  <p>
                    Per le spedizioni con GLS Italia, le informazioni sul mittente non vengono inserite a livello di riga nel file di esportazione. Il sistema Weblabeling (o i servizi web GLS) le applica in automatico attingendole dalle credenziali del tuo account al momento del caricamento del tracciato.
                  </p>
                  <div className="border-t border-[#F3F4F6] pt-4 space-y-3">
                    <p className="font-bold text-gray-800">Prossimi passi:</p>
                    <ul className="space-y-2 list-none pl-0">
                      <li className="flex items-start gap-2">
                        <span className="w-5 h-5 rounded-full bg-[#5A5A40]/10 text-[#5A5A40] flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">1</span>
                        <span>Carica il file XML di Danea Easyfatt a destra</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="w-5 h-5 rounded-full bg-[#5A5A40]/10 text-[#5A5A40] flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">2</span>
                        <span>Verifica e convalida gli indirizzi dei destinatari estratti</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Columns: Drag & Drop + Process Area */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-3xl border border-[#E5E7EB] shadow-sm p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="font-serif font-bold text-base text-[#111827]">Elaborazione DDT Danea XML</h3>
              <span className="text-[10px] uppercase tracking-wider text-[#5A5A40] font-bold bg-[#F4F4F0] px-2.5 py-0.5 rounded-full">Carica File</span>
            </div>

            {/* Drag & Drop Area */}
            <div 
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "border-2 border-dashed rounded-3xl p-10 flex flex-col items-center justify-center gap-4 text-center cursor-pointer transition-all duration-300",
                dragActive 
                  ? "border-[#5A5A40] bg-[#5A5A40]/5" 
                  : "border-[#E5E7EB] hover:border-[#5A5A40]/40 hover:bg-[#F9FAFB]"
              )}
            >
              <input 
                ref={fileInputRef}
                type="file" 
                accept=".xml,.defxml"
                onChange={handleFileInputChange}
                className="hidden" 
              />
              <div className="w-14 h-14 bg-[#5A5A40]/10 rounded-2xl flex items-center justify-center text-[#5A5A40] shadow-inner">
                <Upload size={28} />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-bold text-[#111827]">
                  {fileName ? `File caricato: ${fileName}` : 'Trascina qui il file .DefXml di Danea'}
                </p>
                <p className="text-xs text-[#6B7280]">
                  {fileName ? 'Clicca qui per caricare un altro file' : 'oppure clicca per sfogliare i tuoi file'}
                </p>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-[#9CA3AF] font-bold uppercase tracking-wider">
                <Info size={12} className="text-amber-500" />
                Dati fiscali, contrassegno, pesi e colli estratti automaticamente.
              </div>
            </div>

            {/* Zero state alternative manual insertion */}
            {parsedRows.length === 0 && (
              <div className="text-center py-4 border-t border-[#F3F4F6]">
                <p className="text-xs text-[#6B7280] mb-3">Oppure inizia subito creando una spedizione manuale:</p>
                <button
                  onClick={handleAddManualRow}
                  className="inline-flex items-center gap-2 bg-[#5A5A40] hover:bg-[#4A4A30] text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                >
                  <Plus size={14} />
                  Aggiungi Spedizione Manuale
                </button>
              </div>
            )}

            {/* Statistics Banner */}
            {parsedRows.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-2xl bg-[#F9FAFB] border border-[#F3F4F6]">
                <div className="text-center space-y-0.5">
                  <span className="block text-[10px] font-black text-[#6B7280] uppercase tracking-wider">Totale Spedizioni</span>
                  <span className="text-xl font-serif font-black text-[#111827]">{parsedRows.length}</span>
                </div>
                <div className="text-center space-y-0.5 border-l border-[#E5E7EB]">
                  <span className="block text-[10px] font-black text-emerald-600 uppercase tracking-wider">Pronte</span>
                  <span className="text-xl font-serif font-black text-emerald-600">
                    {parsedRows.filter(r => !r.validation.hasErrors && !r.validation.hasWarnings).length}
                  </span>
                </div>
                <div className="text-center space-y-0.5 border-l border-[#E5E7EB]">
                  <span className="block text-[10px] font-black text-amber-600 uppercase tracking-wider">Avvisi</span>
                  <span className="text-xl font-serif font-black text-amber-600">{warningCount}</span>
                </div>
                <div className="text-center space-y-0.5 border-l border-[#E5E7EB]">
                  <span className="block text-[10px] font-black text-rose-600 uppercase tracking-wider">Bloccanti</span>
                  <span className="text-xl font-serif font-black text-rose-600">{errorCount}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recipient Preview Table */}
      {parsedRows.length > 0 && (
        <div className="bg-white rounded-3xl border border-[#E5E7EB] shadow-sm overflow-hidden">
          <div className="p-6 border-b border-[#F3F4F6] bg-[#F9FAFB]/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-0.5">
              <h3 className="font-serif font-bold text-base text-[#111827]">Elenco e Anteprima Spedizioni</h3>
              <p className="text-xs text-[#6B7280]">
                Clicca sulle celle per modifiche rapide o sull'icona <Settings2 className="inline text-[#5A5A40]" size={13} /> in fondo alla riga per configurare tutti i 76 campi di Poste!
              </p>
            </div>
            
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleAutoFixAll}
                className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm"
                title="Risolvi automaticamente problemi comuni come zeri iniziali del CAP, pesi mancanti e barcode obbligatori"
              >
                <Sparkles size={14} className="text-emerald-600 animate-pulse" />
                Risolvi Avvisi (1-Click)
              </button>

              <button
                onClick={handleAddManualRow}
                className="flex items-center gap-1.5 bg-[#5A5A40] text-white hover:bg-[#4A4A30] px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                <Plus size={14} />
                Aggiungi Nuova
              </button>

              <button
                onClick={() => {
                  if (window.confirm("Svuotare interamente la lista?")) {
                    setParsedRows([]);
                    setFileName(null);
                    setExpandedRowId(null);
                  }
                }}
                className="flex items-center gap-1.5 bg-[#F4F4F0] text-[#5A5A40] border border-[#E5E7EB] px-3.5 py-2 rounded-xl text-xs font-bold hover:bg-[#EBEBE5] transition-colors cursor-pointer"
              >
                <Trash2 size={14} />
                Svuota
              </button>

              {selectedCarrier === 'poste' ? (
                <button
                  onClick={generateCSV}
                  disabled={parsedRows.length === 0}
                  className={cn(
                    "flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer",
                    parsedRows.length > 0
                      ? "bg-amber-500 hover:bg-amber-600 text-white" 
                      : "bg-[#F3F4F6] text-[#9CA3AF] border border-[#E5E7EB] cursor-not-allowed"
                  )}
                  title={parsedRows.length === 0 ? "Importa dei dati o aggiungi una spedizione per sbloccare" : "Clicca per eseguire la validazione e scaricare il tracciato"}
                >
                  <Download size={15} />
                  Esporta CSV Poste (76 Colonne)
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => alert("Tracciato di esportazione GLS in fase di definizione. I dati di spedizione sono stati comunque estratti ed elaborati con successo e sono pronti per essere agganciati non appena saranno concordate le colonne e i delimitatori con la vostra filiale GLS.")}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold bg-amber-500 text-white hover:bg-amber-600 transition-all shadow-sm cursor-pointer"
                >
                  <AlertTriangle size={15} className="animate-pulse text-white" />
                  Mappatura GLS in Standby
                </button>
              )}
            </div>
          </div>

          {/* GLS Specific Info Banner */}
          {selectedCarrier === 'gls' && parsedRows.length > 0 && (
            <div className="bg-amber-50/70 border border-amber-200/60 rounded-2xl p-4 flex items-start gap-3 mx-6 mb-6">
              <Info className="text-amber-600 flex-shrink-0 mt-0.5" size={16} />
              <div className="space-y-1">
                <span className="block text-xs font-bold text-amber-900">
                  Dati dei Destinatari Estratti con Successo per GLS!
                </span>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  L'algoritmo ha estratto correttamente {parsedRows.length} spedizioni dall'XML di Danea. Gli indirizzi, i pesi, i colli e gli importi contrassegno sono stati convalidati e sono pronti. Per abilitare il download del file di esportazione finale (compatibile con GLS Weblabeling / Web Service), inviaci le specifiche o un file di esempio richiesto dalla tua filiale GLS.
                </p>
              </div>
            </div>
          )}

          {/* Verification Banner */}
          {errorCount > 0 && (
            <div className="bg-rose-50 border-b border-rose-100 p-4 px-6 flex items-start gap-3">
              <AlertCircle className="text-rose-600 flex-shrink-0 mt-0.5" size={16} />
              <div className="space-y-0.5">
                <span className="block text-xs font-bold text-rose-800">
                  Rilevati {errorCount} errori di validazione bloccanti!
                </span>
                <p className="text-[11px] text-rose-700">
                  Ogni riga richiede Ragione Sociale, Indirizzo via, Località, Provincia (2 lettere) e CAP (5 cifre). Fai clic sulle celle evidenziate in rosso per compilarle al volo.
                </p>
              </div>
            </div>
          )}

          {/* Interactive Editable Grid */}
          <div className="overflow-x-auto max-w-full">
            <table className="w-full text-left border-collapse min-w-[1200px]">
              <thead>
                <tr className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                  <th className="p-4 pl-6 text-[10px] font-black uppercase text-[#6B7280] tracking-wider w-24">Stato</th>
                  <th className="p-4 text-[10px] font-black uppercase text-[#6B7280] tracking-wider w-24">DDT Rif</th>
                  <th className="p-4 text-[10px] font-black uppercase text-[#6B7280] tracking-wider">Destinatario (Rag. Soc.) *</th>
                  <th className="p-4 text-[10px] font-black uppercase text-[#6B7280] tracking-wider">Indirizzo (Via) *</th>
                  <th className="p-4 text-[10px] font-black uppercase text-[#6B7280] tracking-wider w-24">Civico</th>
                  <th className="p-4 text-[10px] font-black uppercase text-[#6B7280] tracking-wider w-24">CAP *</th>
                  <th className="p-4 text-[10px] font-black uppercase text-[#6B7280] tracking-wider w-36">Località *</th>
                  <th className="p-4 text-[10px] font-black uppercase text-[#6B7280] tracking-wider w-20">Prov *</th>
                  <th className="p-4 text-[10px] font-black uppercase text-[#6B7280] tracking-wider w-20">Nazione</th>
                  <th className="p-4 text-[10px] font-black uppercase text-[#6B7280] tracking-wider w-20">Colli</th>
                  <th className="p-4 text-[10px] font-black uppercase text-[#6B7280] tracking-wider w-20">Peso</th>
                  <th className="p-4 text-[10px] font-black uppercase text-[#6B7280] tracking-wider w-24">Contrassegno</th>
                  <th className="p-4 pr-6 text-[10px] font-black uppercase text-[#6B7280] tracking-wider w-28 text-center">Azioni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F4F6]">
                {parsedRows.map((row) => {
                  const isExpanded = expandedRowId === row.id;
                  return (
                    <React.Fragment key={row.id}>
                      <tr className={cn(
                        "hover:bg-[#F9FAFB]/60 transition-colors text-xs font-medium text-[#111827] cursor-pointer",
                        row.validation.hasErrors && "bg-rose-50/20 hover:bg-rose-50/40",
                        isExpanded && "bg-[#5A5A40]/5"
                      )}>
                        {/* Status Badge */}
                        <td className="p-4 pl-6" onClick={() => setExpandedRowId(isExpanded ? null : row.id)}>
                          {row.validation.hasErrors ? (
                            <span className="flex items-center gap-1 text-[10px] font-bold text-rose-600 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-100 w-fit">
                              <AlertCircle size={12} />
                              Errore
                            </span>
                          ) : row.validation.hasWarnings ? (
                            <span className="flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-100 w-fit">
                              <AlertTriangle size={12} />
                              Avviso
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100 w-fit">
                              <CheckCircle2 size={12} />
                              Pronto
                            </span>
                          )}
                        </td>

                        {/* DDT Reference */}
                        <td className="p-4 font-mono font-bold text-[11px] text-[#6B7280]">
                          {editingRowId === row.id && editingField === 'docNumber' ? (
                            <input
                              type="text"
                              value={tempEditValue}
                              onChange={(e) => setTempEditValue(e.target.value)}
                              onBlur={() => saveEdit(row.id, 'docNumber')}
                              onKeyDown={(e) => handleKeyDown(e, row.id, 'docNumber')}
                              className="w-full bg-white border border-[#5A5A40] rounded px-2 py-1 text-xs"
                              autoFocus
                            />
                          ) : (
                            <span 
                              onClick={() => startEditing(row.id, 'docNumber', row.docNumber)}
                              className="cursor-pointer hover:bg-[#F4F4F0] px-1 py-0.5 rounded transition-colors"
                            >
                              {row.docNumber || '-'}
                            </span>
                          )}
                        </td>

                        {/* Recipient Name */}
                        <td className="p-4">
                          {editingRowId === row.id && editingField === 'recipientName' ? (
                            <input
                              type="text"
                              value={tempEditValue}
                              onChange={(e) => setTempEditValue(e.target.value)}
                              onBlur={() => saveEdit(row.id, 'recipientName')}
                              onKeyDown={(e) => handleKeyDown(e, row.id, 'recipientName')}
                              className="w-full bg-white border border-[#5A5A40] rounded px-2 py-1 text-xs"
                              autoFocus
                            />
                          ) : (
                            <div 
                              onClick={() => startEditing(row.id, 'recipientName', row.recipientName)}
                              className={cn(
                                "cursor-pointer px-1.5 py-1 rounded transition-all min-h-[24px] flex items-center",
                                row.validation.nameError 
                                  ? "bg-rose-50 border border-dashed border-rose-300 text-rose-800" 
                                  : "hover:bg-[#F4F4F0]"
                              )}
                            >
                              <span className="truncate max-w-[140px]">{row.recipientName || 'Compila *'}</span>
                              {row.validation.nameError && <Edit3 size={11} className="ml-auto text-rose-500" />}
                            </div>
                          )}
                        </td>

                        {/* Street Address */}
                        <td className="p-4">
                          {editingRowId === row.id && editingField === 'via' ? (
                            <input
                              type="text"
                              value={tempEditValue}
                              onChange={(e) => setTempEditValue(e.target.value)}
                              onBlur={() => saveEdit(row.id, 'via')}
                              onKeyDown={(e) => handleKeyDown(e, row.id, 'via')}
                              className="w-full bg-white border border-[#5A5A40] rounded px-2 py-1 text-xs"
                              autoFocus
                            />
                          ) : (
                            <div 
                              onClick={() => startEditing(row.id, 'via', row.via)}
                              className={cn(
                                "cursor-pointer px-1.5 py-1 rounded transition-all min-h-[24px] flex items-center",
                                row.validation.addressError 
                                  ? "bg-rose-50 border border-dashed border-rose-300 text-rose-800" 
                                  : "hover:bg-[#F4F4F0]"
                              )}
                            >
                              <span className="truncate max-w-[140px]">{row.via || 'Compila *'}</span>
                              {row.validation.addressError && <Edit3 size={11} className="ml-auto text-rose-500" />}
                            </div>
                          )}
                        </td>

                        {/* Civic Number */}
                        <td className="p-4">
                          {editingRowId === row.id && editingField === 'civico' ? (
                            <input
                              type="text"
                              value={tempEditValue}
                              onChange={(e) => setTempEditValue(e.target.value)}
                              onBlur={() => saveEdit(row.id, 'civico')}
                              onKeyDown={(e) => handleKeyDown(e, row.id, 'civico')}
                              className="w-full bg-white border border-[#5A5A40] rounded px-1 py-1 text-xs"
                              autoFocus
                            />
                          ) : (
                            <div 
                              onClick={() => startEditing(row.id, 'civico', row.civico)}
                              className={cn(
                                "cursor-pointer px-1.5 py-1 rounded transition-all min-h-[24px] flex items-center",
                                row.validation.civicWarning 
                                  ? "bg-amber-50 border border-dashed border-amber-300 text-amber-800" 
                                  : "hover:bg-[#F4F4F0]"
                              )}
                            >
                              <span>{row.civico || 'Vuoto'}</span>
                            </div>
                          )}
                        </td>

                        {/* CAP */}
                        <td className="p-4 font-mono">
                          {editingRowId === row.id && editingField === 'cap' ? (
                            <input
                              type="text"
                              maxLength={5}
                              value={tempEditValue}
                              onChange={(e) => setTempEditValue(e.target.value)}
                              onBlur={() => saveEdit(row.id, 'cap')}
                              onKeyDown={(e) => handleKeyDown(e, row.id, 'cap')}
                              className="w-full bg-white border border-[#5A5A40] rounded px-1.5 py-1 text-xs"
                              autoFocus
                            />
                          ) : (
                            <div 
                              onClick={() => startEditing(row.id, 'cap', row.cap)}
                              className={cn(
                                "cursor-pointer px-1.5 py-1 rounded transition-all min-h-[24px] flex items-center",
                                row.validation.capError 
                                  ? "bg-rose-50 border border-dashed border-rose-300 text-rose-800 font-bold" 
                                  : "hover:bg-[#F4F4F0]"
                              )}
                            >
                              <span>{row.cap || 'Vuoto'}</span>
                            </div>
                          )}
                        </td>

                        {/* Localita */}
                        <td className="p-4">
                          {editingRowId === row.id && editingField === 'localita' ? (
                            <input
                              type="text"
                              value={tempEditValue}
                              onChange={(e) => setTempEditValue(e.target.value)}
                              onBlur={() => saveEdit(row.id, 'localita')}
                              onKeyDown={(e) => handleKeyDown(e, row.id, 'localita')}
                              className="w-full bg-white border border-[#5A5A40] rounded px-2 py-1 text-xs"
                              autoFocus
                            />
                          ) : (
                            <div 
                              onClick={() => startEditing(row.id, 'localita', row.localita)}
                              className={cn(
                                "cursor-pointer px-1.5 py-1 rounded transition-all min-h-[24px] flex items-center",
                                row.validation.localitaError 
                                  ? "bg-rose-50 border border-dashed border-rose-300 text-rose-800" 
                                  : "hover:bg-[#F4F4F0]"
                              )}
                            >
                              <span className="truncate max-w-[100px]">{row.localita || 'Vuoto'}</span>
                            </div>
                          )}
                        </td>

                        {/* Provincia */}
                        <td className="p-4 font-mono text-center">
                          {editingRowId === row.id && editingField === 'provincia' ? (
                            <input
                              type="text"
                              maxLength={2}
                              value={tempEditValue}
                              onChange={(e) => setTempEditValue(e.target.value.toUpperCase())}
                              onBlur={() => saveEdit(row.id, 'provincia')}
                              onKeyDown={(e) => handleKeyDown(e, row.id, 'provincia')}
                              className="w-12 bg-white border border-[#5A5A40] rounded px-1 py-1 text-xs mx-auto block text-center"
                              autoFocus
                            />
                          ) : (
                            <div 
                              onClick={() => startEditing(row.id, 'provincia', row.provincia)}
                              className={cn(
                                "cursor-pointer px-1 py-1 rounded transition-all min-h-[24px] flex items-center justify-center",
                                row.validation.provinciaError 
                                  ? "bg-rose-50 border border-dashed border-rose-300 text-rose-800 font-bold" 
                                  : "hover:bg-[#F4F4F0]"
                              )}
                            >
                              <span>{row.provincia || '??'}</span>
                            </div>
                          )}
                        </td>

                        {/* Country Code */}
                        <td className="p-4 font-mono text-center text-[#6B7280]">
                          <span onClick={() => startEditing(row.id, 'country', row.country)}>
                            {row.country || 'IT'}
                          </span>
                        </td>

                        {/* Colli */}
                        <td className="p-4 font-mono text-center">
                          {editingRowId === row.id && editingField === 'colli' ? (
                            <input
                              type="text"
                              value={tempEditValue}
                              onChange={(e) => setTempEditValue(e.target.value)}
                              onBlur={() => saveEdit(row.id, 'colli')}
                              onKeyDown={(e) => handleKeyDown(e, row.id, 'colli')}
                              className="w-10 bg-white border border-[#5A5A40] rounded text-center text-xs py-0.5"
                              autoFocus
                            />
                          ) : (
                            <span onClick={() => startEditing(row.id, 'colli', row.colli)} className="cursor-pointer">
                              {row.colli || '1'}
                            </span>
                          )}
                        </td>

                        {/* Peso */}
                        <td className="p-4 font-mono text-center">
                          {editingRowId === row.id && editingField === 'peso' ? (
                            <input
                              type="text"
                              value={tempEditValue}
                              onChange={(e) => setTempEditValue(e.target.value)}
                              onBlur={() => saveEdit(row.id, 'peso')}
                              onKeyDown={(e) => handleKeyDown(e, row.id, 'peso')}
                              className="w-12 bg-white border border-[#5A5A40] rounded text-center text-xs py-0.5"
                              autoFocus
                            />
                          ) : (
                            <span onClick={() => startEditing(row.id, 'peso', row.peso)} className="cursor-pointer">
                              {row.peso || '1.0'}
                            </span>
                          )}
                        </td>

                        {/* Contrassegno status */}
                        <td className="p-4 font-mono text-center">
                          {row.importoContrassegno ? (
                            <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">
                              €{row.importoContrassegno}
                            </span>
                          ) : (
                            <span className="text-gray-400 text-[10px]">-</span>
                          )}
                        </td>

                        {/* Action buttons */}
                        <td className="p-4 pr-6 text-center flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => setExpandedRowId(isExpanded ? null : row.id)}
                            className={cn(
                              "p-1.5 rounded-lg transition-colors border",
                              isExpanded 
                                ? "bg-[#5A5A40] border-[#5A5A40] text-white" 
                                : "bg-[#F9FAFB] border-[#E5E7EB] text-[#5A5A40] hover:bg-[#F4F4F0]"
                            )}
                            title="Modifica Avanzata (Tutti i campi)"
                          >
                            <Settings2 size={13} />
                          </button>
                          
                          <button
                            onClick={() => handleDeleteRow(row.id)}
                            className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 p-1.5 rounded-lg transition-colors border border-transparent"
                            title="Rimuovi"
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>

                      {/* Expandable Bento Grid Detail Section */}
                      {isExpanded && (
                        <tr className="bg-[#F9FAFB]/70 border-b border-[#E5E7EB]">
                          <td colSpan={13} className="p-6">
                            <div className="bg-white rounded-3xl border border-[#E5E7EB] p-6 shadow-inner space-y-6">
                              <div className="flex items-center justify-between border-b border-[#F3F4F6] pb-3">
                                <div className="flex items-center gap-2">
                                  <SlidersHorizontal className="text-[#5A5A40]" size={16} />
                                  <h4 className="font-serif font-black text-sm text-[#111827]">
                                    Modifica Spedizione Completa (76 Campi Poste)
                                  </h4>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] text-[#6B7280] font-mono">DDT Ref: <strong>{row.docNumber}</strong></span>
                                  <button 
                                    onClick={() => setExpandedRowId(null)}
                                    className="text-xs font-bold text-[#5A5A40] hover:underline"
                                  >
                                    Chiudi Dettagli
                                  </button>
                                </div>
                              </div>

                              {/* Row-specific detailed error and warning messages */}
                              {((row.validation.messages && row.validation.messages.length > 0) || (row.validation.warnings && row.validation.warnings.length > 0)) && (
                                <div className="space-y-4">
                                  {/* Quick Auto-Fix Action Banner */}
                                  <div className="bg-emerald-50/80 border border-emerald-100/60 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-emerald-800 shadow-inner animate-fadeIn">
                                    <div className="flex items-start sm:items-center gap-2.5">
                                      <Sparkles size={16} className="text-emerald-600 animate-pulse shrink-0 mt-0.5 sm:mt-0" />
                                      <p className="leading-relaxed">
                                        <strong>Risoluzione assistita:</strong> Posso ottimizzare questa spedizione correggendo zeri dei CAP, impostando pesi di default, o associando i codici servizio Poste consigliati (es. multicollo o contrassegno).
                                      </p>
                                    </div>
                                    <button
                                      onClick={() => {
                                        const { fixedRow, logs } = autoFixRow(row);
                                        if (logs.length > 0) {
                                          setParsedRows(prev => prev.map(r => r.id === row.id ? fixedRow : r));
                                          alert(`Correzioni automatiche applicate con successo:\n\n` + logs.map(l => `- ${l}`).join('\n'));
                                        } else {
                                          alert(`Nessuna correzione automatica immediata applicabile per questo DDT. Correggi i restanti dati manualmente.`);
                                        }
                                      }}
                                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3.5 py-1.5 rounded-xl text-[11px] transition-all cursor-pointer shadow-sm shrink-0 whitespace-nowrap self-end sm:self-auto"
                                    >
                                      Sistemalo in 1-Click
                                    </button>
                                  </div>

                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fadeIn">
                                    {row.validation.messages && row.validation.messages.length > 0 && (
                                      <div className="bg-rose-50 border border-rose-100 p-4 rounded-2xl space-y-1.5 shadow-sm">
                                        <div className="flex items-center gap-1.5 text-xs font-bold text-rose-800 uppercase tracking-wide">
                                          <AlertCircle size={14} className="text-rose-600 animate-pulse" />
                                          <span>Errori bloccanti ({row.validation.messages.length})</span>
                                        </div>
                                        <ul className="list-disc pl-5 text-[11px] text-rose-700 space-y-1 font-medium">
                                          {row.validation.messages.map((msg, idx) => (
                                            <li key={idx}>{msg}</li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}
                                    {row.validation.warnings && row.validation.warnings.length > 0 && (
                                      <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl space-y-1.5 shadow-sm">
                                        <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800 uppercase tracking-wide">
                                          <AlertTriangle size={14} className="text-amber-600" />
                                          <span>Consigli / Avvertenze ({row.validation.warnings.length})</span>
                                        </div>
                                        <ul className="list-disc pl-5 text-[11px] text-amber-700 space-y-1 font-medium">
                                          {row.validation.warnings.map((msg, idx) => (
                                            <li key={idx}>{msg}</li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* Schema-based dynamic grid sections */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {ADVANCED_SECTIONS.map((section, sIdx) => (
                                  <div key={sIdx} className="space-y-3 bg-[#F9FAFB]/50 p-4 rounded-2xl border border-[#F3F4F6]">
                                    <h5 className="text-[11px] font-black text-[#5A5A40] uppercase tracking-wider border-b border-[#E5E7EB] pb-1.5 flex items-center gap-1.5">
                                      <Sparkles size={12} className="text-amber-500" />
                                      {section.title}
                                    </h5>
                                    <div className="grid grid-cols-2 gap-3.5">
                                      {section.fields.map((field) => {
                                        const value = (row as any)[field.key] || '';
                                        return (
                                          <div key={field.key} className={cn("space-y-1", field.key === 'note' && "col-span-2")}>
                                            <label className="block text-[10px] font-bold text-[#4B5563] uppercase tracking-wide">
                                              {field.label}
                                            </label>
                                            {field.type === 'select' ? (
                                              <select
                                                value={value || ''}
                                                onChange={(e) => handleRowFieldChange(row.id, field.key as keyof DestinationRow, e.target.value)}
                                                className="w-full bg-white border border-[#E5E7EB] rounded-lg px-2 py-1.5 text-xs focus:border-[#5A5A40] outline-none"
                                              >
                                                {field.options?.map((opt) => (
                                                  <option key={opt} value={opt}>{opt || '(vuoto)'}</option>
                                                ))}
                                              </select>
                                            ) : (
                                              <input
                                                type={field.type}
                                                value={value}
                                                onChange={(e) => handleRowFieldChange(row.id, field.key as keyof DestinationRow, e.target.value)}
                                                placeholder={field.placeholder}
                                                className="w-full bg-white border border-[#E5E7EB] rounded-lg px-2.5 py-1.5 text-xs focus:border-[#5A5A40] outline-none"
                                              />
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                ))}
                              </div>

                              {/* Gestione Dettaglio Colli Multipli */}
                              <div className="bg-[#5A5A40]/5 p-5 rounded-2xl border border-[#5A5A40]/15 space-y-4">
                                <div className="flex items-center justify-between border-b border-[#5A5A40]/10 pb-2">
                                  <div className="flex items-center gap-2">
                                    <Box className="text-[#5A5A40]" size={16} />
                                    <h4 className="font-serif font-bold text-sm text-[#5A5A40]">
                                      Dettaglio Colli Multipli ({parseInt(row.colli || '1') > 1 ? `${row.colli} Colli` : "Collo Singolo"})
                                    </h4>
                                  </div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    {parseInt(row.colli || '1') > 1 && (
                                      <>
                                        <button
                                          type="button"
                                          onClick={() => handleApplyDimensionsToAllPackages(row.id)}
                                          className="flex items-center gap-1 text-[10px] font-bold text-white bg-[#5A5A40] hover:bg-[#4a4a35] px-2.5 py-1 rounded-lg border border-transparent shadow-sm transition-all cursor-pointer"
                                          title="Copia le dimensioni principali di Pacco & Dimensioni su ciascun collo di questa spedizione"
                                        >
                                          <SlidersHorizontal size={10} />
                                          Configura su tutti
                                        </button>
                                        <span className="text-[10px] bg-[#5A5A40]/15 text-[#5A5A40] px-2 py-0.5 rounded-md font-bold">
                                          Opzione APT000945 Attiva
                                        </span>
                                      </>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => handleAddPackage(row.id)}
                                      className="flex items-center gap-1 text-[10px] font-bold text-[#5A5A40] hover:text-white bg-[#5A5A40]/10 hover:bg-[#5A5A40] px-2.5 py-1 rounded-lg border border-[#5A5A40]/20 transition-all cursor-pointer"
                                    >
                                      <Plus size={10} />
                                      Aggiungi Collo
                                    </button>
                                  </div>
                                </div>

                                {parseInt(row.colli || '1') > 1 ? (
                                  <div className="space-y-3">
                                    <p className="text-[11px] text-[#6B7280]">
                                      Per spedizioni multiple (multicollo) è consigliato specificare peso e dimensioni per ciascun collo. Al momento dell'esportazione CSV, il sistema sdoppierà automaticamente le riga assegnando un identificativo collo univoco e pre-inietterà il codice servizio <strong className="text-[#111827]">APT000945</strong> nel Barcode Servizio.
                                      <br />
                                      <span className="text-[#5A5A40] font-semibold">Suggerimento:</span> Compila le dimensioni desiderate nella sezione <strong className="text-[#111827]">"Pacco & Dimensioni"</strong> sopra e clicca su <strong className="text-[#111827]">"Configura su tutti"</strong> per applicarle istantaneamente a tutti i singoli colli.
                                    </p>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                      {(row.packages || []).map((pkg, idx) => (
                                        <div key={pkg.id} className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-sm flex flex-col gap-2 relative">
                                          <div className="flex items-center justify-between">
                                            <span className="text-[11px] font-black text-gray-700">COLLO #{idx + 1}</span>
                                            <button
                                              type="button"
                                              onClick={() => handleRemovePackage(row.id, pkg.id)}
                                              className="text-rose-500 hover:text-rose-700 p-1 text-[10px] font-bold flex items-center gap-0.5 cursor-pointer"
                                            >
                                              <Trash2 size={11} />
                                              Rimuovi
                                            </button>
                                          </div>
                                          <div className="grid grid-cols-4 gap-2">
                                            <div>
                                              <label className="block text-[9px] font-bold text-gray-500 uppercase">Peso (kg)</label>
                                              <input
                                                type="text"
                                                value={pkg.peso}
                                                onChange={(e) => handlePackageFieldChange(row.id, pkg.id, 'peso', e.target.value)}
                                                className="w-full bg-white border border-gray-200 rounded px-1.5 py-1 text-xs text-center outline-none focus:border-[#5A5A40]"
                                              />
                                            </div>
                                            <div>
                                              <label className="block text-[9px] font-bold text-gray-500 uppercase">Largh (cm)</label>
                                              <input
                                                type="text"
                                                value={pkg.larghezza}
                                                onChange={(e) => handlePackageFieldChange(row.id, pkg.id, 'larghezza', e.target.value)}
                                                className="w-full bg-white border border-gray-200 rounded px-1.5 py-1 text-xs text-center outline-none focus:border-[#5A5A40]"
                                              />
                                            </div>
                                            <div>
                                              <label className="block text-[9px] font-bold text-gray-500 uppercase">Alt (cm)</label>
                                              <input
                                                type="text"
                                                value={pkg.altezza}
                                                onChange={(e) => handlePackageFieldChange(row.id, pkg.id, 'altezza', e.target.value)}
                                                className="w-full bg-white border border-gray-200 rounded px-1.5 py-1 text-xs text-center outline-none focus:border-[#5A5A40]"
                                              />
                                            </div>
                                            <div>
                                              <label className="block text-[9px] font-bold text-gray-500 uppercase">Prof (cm)</label>
                                              <input
                                                type="text"
                                                value={pkg.profondita}
                                                onChange={(e) => handlePackageFieldChange(row.id, pkg.id, 'profondita', e.target.value)}
                                                className="w-full bg-white border border-gray-200 rounded px-1.5 py-1 text-xs text-center outline-none focus:border-[#5A5A40]"
                                              />
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ) : (
                                  <p className="text-[11px] text-[#6B7280] italic">
                                    Questa spedizione ha attualmente 1 collo. Modifica il campo "Colli" in tabella o clicca su "Aggiungi Collo" per renderla una spedizione multicollo e configurare pesi e dimensioni differenti per ciascun collo.
                                  </p>
                                )}
                              </div>

                              {/* Separate Pickup Section (Ritiro Specifico) */}
                              <details className="group border-t border-[#F3F4F6] pt-4">
                                <summary className="flex items-center justify-between text-xs font-bold text-[#5A5A40] cursor-pointer list-none select-none">
                                  <span>Dati Ritiro Alternativo Specifico (Facoltativo - Sovrascrive Mittente)</span>
                                  <span className="transition-transform group-open:rotate-180">
                                    <ChevronDown size={14} />
                                  </span>
                                </summary>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 bg-[#F9FAFB]/40 p-4 rounded-2xl border border-[#F3F4F6]">
                                  <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-[#4B5563]">Ragione Sociale Ritiro</label>
                                    <input type="text" value={row.ritiroName} onChange={(e) => handleRowFieldChange(row.id, 'ritiroName', e.target.value)} className="w-full bg-white border border-[#E5E7EB] rounded-lg p-1.5 text-xs" />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-[#4B5563]">Referente Ritiro</label>
                                    <input type="text" value={row.ritiroContactRef} onChange={(e) => handleRowFieldChange(row.id, 'ritiroContactRef', e.target.value)} className="w-full bg-white border border-[#E5E7EB] rounded-lg p-1.5 text-xs" />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-[#4B5563]">Email Ritiro</label>
                                    <input type="text" value={row.ritiroEmail} onChange={(e) => handleRowFieldChange(row.id, 'ritiroEmail', e.target.value)} className="w-full bg-white border border-[#E5E7EB] rounded-lg p-1.5 text-xs" />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-[#4B5563]">Telefono Ritiro</label>
                                    <input type="text" value={row.ritiroPhone} onChange={(e) => handleRowFieldChange(row.id, 'ritiroPhone', e.target.value)} className="w-full bg-white border border-[#E5E7EB] rounded-lg p-1.5 text-xs" />
                                  </div>
                                  <div className="space-y-1 col-span-2">
                                    <label className="text-[10px] font-bold text-[#4B5563]">Via Ritiro</label>
                                    <input type="text" value={row.ritiroVia} onChange={(e) => handleRowFieldChange(row.id, 'ritiroVia', e.target.value)} className="w-full bg-white border border-[#E5E7EB] rounded-lg p-1.5 text-xs" />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-[#4B5563]">Civico</label>
                                    <input type="text" value={row.ritiroCivic} onChange={(e) => handleRowFieldChange(row.id, 'ritiroCivic', e.target.value)} className="w-full bg-white border border-[#E5E7EB] rounded-lg p-1.5 text-xs" />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-[#4B5563]">CAP Ritiro</label>
                                    <input type="text" value={row.ritiroCap} onChange={(e) => handleRowFieldChange(row.id, 'ritiroCap', e.target.value)} className="w-full bg-white border border-[#E5E7EB] rounded-lg p-1.5 text-xs" />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-[#4B5563]">Località Ritiro</label>
                                    <input type="text" value={row.ritiroLocalita} onChange={(e) => handleRowFieldChange(row.id, 'ritiroLocalita', e.target.value)} className="w-full bg-white border border-[#E5E7EB] rounded-lg p-1.5 text-xs" />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-[#4B5563]">Provincia Ritiro</label>
                                    <input type="text" value={row.ritiroProvincia} onChange={(e) => handleRowFieldChange(row.id, 'ritiroProvincia', e.target.value)} className="w-full bg-white border border-[#E5E7EB] rounded-lg p-1.5 text-xs" />
                                  </div>
                                </div>
                              </details>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-3xl border border-[#E5E7EB] p-6 space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-[#5A5A40]/10 text-[#5A5A40] rounded-lg flex items-center justify-center">
              <Info size={16} />
            </div>
            <h4 className="font-serif font-bold text-sm text-[#111827]">Come funziona l'esportazione?</h4>
          </div>
          <p className="text-xs text-[#6B7280] leading-relaxed">
            Esporta i DDT da Danea in formato <strong className="text-[#111827]">XML (.DefXml)</strong> dal menu Strumenti/Esporta. Trascina poi il file qui. Il sistema estrarrà i destinatari, contatti, P.IVA/Codice Fiscale, pesi, colli, e <strong>rileverà in automatico se il pagamento è in contrassegno</strong> pre-compilando l'importo e il tipo di pagamento "CONTANTI".
          </p>
        </div>

        <div className="bg-white rounded-3xl border border-[#E5E7EB] p-6 space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center">
              <ShieldCheck size={16} />
            </div>
            <h4 className="font-serif font-bold text-sm text-[#111827]">Privacy e Sicurezza Garantite</h4>
          </div>
          <p className="text-xs text-[#6B7280] leading-relaxed">
            I dati sensibili non lasciano mai il tuo browser. L'elaborazione dell'XML e la generazione del file CSV avvengono <strong className="text-emerald-700">interamente sul tuo computer client-side</strong>. Nessun dato viene trasmesso a server esterni o salvato nel cloud.
          </p>
        </div>
      </div>
    </div>
  );
}
