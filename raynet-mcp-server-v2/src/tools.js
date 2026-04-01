// src/tools.js
'use strict';

const { RaynetClient: C } = require('./client');

function tools(client) {
  const R = C;

  return [

    // ═══════════════════════════════════════════════════════
    // FIRMY
    // ═══════════════════════════════════════════════════════
    {
      name: 'seznam_firem',
      description: 'Vypíše seznam firem z Raynet CRM s filtrováním.',
      inputSchema: { type: 'object', properties: {
        fulltext: { type: 'string' },
        stav: { type: 'string', enum: ['A_POTENTIAL','B_ACTUAL','C_DEFERRED','D_ENDED','D_UNATTRACTIVE'] },
        role: { type: 'string', enum: ['A_SUBSCRIBER','B_PARTNER','C_SUPPLIER','D_RIVAL'] },
        rating: { type: 'string', enum: ['A','B','C'] },
        limit: { type: 'number', default: 20 },
        offset: { type: 'number', default: 0 },
      }},
      handler: async (a) => {
        const p = { limit: a.limit||20, offset: a.offset||0 };
        if (a.fulltext) p['fulltext'] = a.fulltext;
        if (a.stav) p['state[EQ]'] = a.stav;
        if (a.role) p['role[EQ]'] = a.role;
        if (a.rating) p['rating[EQ]'] = a.rating;
        const r = await client.get('/company/', p);
        if (!r.success) return `Chyba: ${r.error}`;
        const d = Array.isArray(r.data) ? r.data : [];
        if (!d.length) return 'Žádné firmy nenalezeny.';
        return `Nalezeno ${r.totalCount||d.length} firem:\n\n` +
          d.map(f => `**${f.name}** (ID: ${f.id})\n  Stav: ${f.state?.code||'-'} | Rating: ${f.rating?.code||'-'} | Vlastník: ${f.owner?.fullName||'-'}\n  IČO: ${f.regNumber||'-'} | Tel: ${f.primaryPhone||'-'} | Email: ${f.primaryEmail||'-'}`).join('\n\n');
      },
    },
    {
      name: 'detail_firmy',
      description: 'Zobrazí kompletní detail firmy včetně volitelných polí.',
      inputSchema: { type: 'object', properties: { id: { type: 'number' } }, required: ['id'] },
      handler: async (a) => {
        const r = await client.get(`/company/${a.id}/`);
        if (!r.success) return `Chyba: ${r.error}`;
        const f = r.data;
        let out = `## ${f.name} (ID: ${f.id})\n`;
        out += `- **Stav:** ${f.state?.code||'-'} | **Rating:** ${f.rating?.code||'-'} | **Role:** ${f.role?.code||'-'}\n`;
        out += `- **IČO:** ${f.regNumber||'-'} | **DIČ:** ${f.taxNumber||'-'}\n`;
        out += `- **Vlastník:** ${f.owner?.fullName||'-'}\n`;
        out += `- **Tel:** ${f.primaryPhone||'-'} | **Email:** ${f.primaryEmail||'-'}\n`;
        if (f.addresses?.length) {
          out += `\n**Adresy:**\n`;
          f.addresses.forEach(a => out += `  - ${a.street||''} ${a.city||''} ${a.zipCode||''}\n`);
        }
        if (f.customFields && Object.keys(f.customFields).length) {
          out += `\n**Volitelná pole:**\n`;
          for (const [k,v] of Object.entries(f.customFields)) {
            if (v !== null && v !== '') out += `  - ${k}: ${JSON.stringify(v)}\n`;
          }
        }
        return out;
      },
    },
    {
      name: 'vytvor_firmu',
      description: 'Vytvoří novou firmu v Raynet CRM.',
      inputSchema: { type: 'object', properties: {
        nazev: { type: 'string' }, rating: { type: 'string', enum: ['A','B','C'] },
        stav: { type: 'string', enum: ['A_POTENTIAL','B_ACTUAL','C_DEFERRED','D_ENDED'] },
        role: { type: 'string', enum: ['A_SUBSCRIBER','B_PARTNER','C_SUPPLIER','D_RIVAL'] },
        ico: { type: 'string' }, dic: { type: 'string' },
        telefon: { type: 'string' }, email: { type: 'string' }, web: { type: 'string' },
        poznamka: { type: 'string' }, vlastnikId: { type: 'number' },
      }, required: ['nazev','rating','stav','role'] },
      handler: async (a) => {
        const body = R.body({
          name: a.nazev, rating: a.rating, state: a.stav, role: a.role,
          regNumber: a.ico, taxNumber: a.dic, notice: a.poznamka,
          owner: R.ref(a.vlastnikId),
          contactInfo: (a.telefon||a.email||a.web) ? {
            email: a.email ? [{email: a.email}] : undefined,
            tel: a.telefon ? [{tel: a.telefon}] : undefined,
            www: a.web ? [{www: a.web}] : undefined,
          } : undefined,
        });
        const r = await client.put('/company/', body);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ Firma "${a.nazev}" vytvořena. ID: ${r.data?.id}`;
      },
    },
    {
      name: 'uprav_firmu',
      description: 'Upraví existující firmu včetně volitelných polí.',
      inputSchema: { type: 'object', properties: {
        id: { type: 'number' }, nazev: { type: 'string' }, rating: { type: 'string' },
        stav: { type: 'string' }, ico: { type: 'string' }, dic: { type: 'string' },
        poznamka: { type: 'string' }, volitelnaPolea: { type: 'object' },
      }, required: ['id'] },
      handler: async (a) => {
        const body = R.body({ name: a.nazev, rating: a.rating, state: a.stav,
          regNumber: a.ico, taxNumber: a.dic, notice: a.poznamka, customFields: a.volitelnaPolea });
        const r = await client.post(`/company/${a.id}/`, body);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ Firma ID ${a.id} upravena.`;
      },
    },
    {
      name: 'volitelna_pole_firmy',
      description: 'Načte nebo uloží volitelná pole firmy.',
      inputSchema: { type: 'object', properties: {
        firmaId: { type: 'number' }, pole: { type: 'object' },
      }, required: ['firmaId'] },
      handler: async (a) => {
        if (a.pole) {
          const r = await client.post(`/company/${a.firmaId}/`, { customFields: a.pole });
          if (!r.success) return `Chyba: ${r.error}`;
          return `✅ Volitelná pole firmy ID ${a.firmaId} uložena.`;
        }
        const r = await client.get(`/company/${a.firmaId}/`);
        if (!r.success) return `Chyba: ${r.error}`;
        const cf = r.data?.customFields || {};
        if (!Object.keys(cf).length) return 'Firma nemá vyplněná volitelná pole.';
        return `**Volitelná pole:**\n` + Object.entries(cf).map(([k,v]) => `- ${k}: ${JSON.stringify(v)}`).join('\n');
      },
    },

    // ═══════════════════════════════════════════════════════
    // KONTAKTY
    // ═══════════════════════════════════════════════════════
    {
      name: 'seznam_kontaktu',
      description: 'Vypíše seznam kontaktních osob.',
      inputSchema: { type: 'object', properties: {
        fulltext: { type: 'string' }, firmaId: { type: 'number' },
        limit: { type: 'number', default: 20 }, offset: { type: 'number', default: 0 },
      }},
      handler: async (a) => {
        const p = { limit: a.limit||20, offset: a.offset||0 };
        if (a.fulltext) p['fulltext'] = a.fulltext;
        if (a.firmaId) p['company[EQ]'] = a.firmaId;
        const r = await client.get('/person/', p);
        if (!r.success) return `Chyba: ${r.error}`;
        const d = Array.isArray(r.data) ? r.data : [];
        if (!d.length) return 'Žádné kontakty nenalezeny.';
        return `Nalezeno ${r.totalCount||d.length} kontaktů:\n\n` +
          d.map(k => `**${k.firstName||''} ${k.lastName||''}** (ID: ${k.id})\n  Firma: ${k.company?.name||'-'} | Email: ${k.primaryEmail||'-'} | Tel: ${k.primaryPhone||'-'}`).join('\n\n');
      },
    },
    {
      name: 'vytvor_kontakt',
      description: 'Vytvoří novou kontaktní osobu.',
      inputSchema: { type: 'object', properties: {
        prijmeni: { type: 'string' }, jmeno: { type: 'string' },
        firmaId: { type: 'number' }, telefon: { type: 'string' }, email: { type: 'string' }, poznamka: { type: 'string' },
      }, required: ['prijmeni'] },
      handler: async (a) => {
        const body = R.body({ lastName: a.prijmeni, firstName: a.jmeno, notice: a.poznamka,
          relationship: a.firmaId ? { company: { id: a.firmaId }, type: 'EMPLOYEE' } : undefined,
          contactInfo: (a.email||a.telefon) ? {
            email: a.email ? [{email: a.email}] : undefined,
            tel: a.telefon ? [{tel: a.telefon}] : undefined,
          } : undefined,
        });
        const r = await client.put('/person/', body);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ Kontakt "${a.jmeno||''} ${a.prijmeni}" vytvořen. ID: ${r.data?.id}`;
      },
    },

    // ═══════════════════════════════════════════════════════
    // OBCHODNÍ PŘÍPADY
    // ═══════════════════════════════════════════════════════
    {
      name: 'seznam_op',
      description: 'Vypíše seznam obchodních případů.',
      inputSchema: { type: 'object', properties: {
        fulltext: { type: 'string' }, firmaId: { type: 'number' }, faze: { type: 'string' },
        limit: { type: 'number', default: 20 }, offset: { type: 'number', default: 0 },
      }},
      handler: async (a) => {
        const p = { limit: a.limit||20, offset: a.offset||0 };
        if (a.fulltext) p['fulltext'] = a.fulltext;
        if (a.firmaId) p['company[EQ]'] = a.firmaId;
        if (a.faze) p['businessCasePhase[EQ]'] = a.faze;
        const r = await client.get('/businessCase/', p);
        if (!r.success) return `Chyba: ${r.error}`;
        const d = Array.isArray(r.data) ? r.data : [];
        if (!d.length) return 'Žádné OP nenalezeny.';
        return `Nalezeno ${r.totalCount||d.length} OP:\n\n` +
          d.map(o => `**${o.name}** (${o.code||'-'}, ID: ${o.id})\n  Firma: ${o.company?.name||'-'} | Fáze: ${o.businessCasePhase?.name||'-'} | Hodnota: ${o.totalAmount||0} Kč`).join('\n\n');
      },
    },
    {
      name: 'detail_op',
      description: 'Zobrazí detail obchodního případu včetně položek a volitelných polí.',
      inputSchema: { type: 'object', properties: { id: { type: 'number' } }, required: ['id'] },
      handler: async (a) => {
        const r = await client.get(`/businessCase/${a.id}/`);
        if (!r.success) return `Chyba: ${r.error}`;
        const o = r.data;
        let out = `## ${o.name} (${o.code||'-'}, ID: ${o.id})\n`;
        out += `- **Firma:** ${o.company?.name||'-'} | **Fáze:** ${o.businessCasePhase?.name||'-'}\n`;
        out += `- **Hodnota:** ${o.totalAmount||0} Kč | **Pravděpodobnost:** ${o.probability||0}%\n`;
        out += `- **Vlastník:** ${o.owner?.fullName||'-'} | **Platnost od:** ${o.validFrom||'-'}\n`;
        if (o.items?.length) {
          out += `\n**Položky (${o.items.length}):**\n`;
          o.items.forEach(i => out += `  - ${i.name} | ${i.count||'?'} ${i.unit||'ks'} × ${i.price||0} Kč\n`);
        }
        if (o.customFields && Object.keys(o.customFields).length) {
          out += `\n**Volitelná pole:**\n`;
          for (const [k,v] of Object.entries(o.customFields)) if (v !== null && v !== '') out += `  - ${k}: ${JSON.stringify(v)}\n`;
        }
        return out;
      },
    },
    {
      name: 'vytvor_op',
      description: 'Vytvoří nový obchodní případ.',
      inputSchema: { type: 'object', properties: {
        nazev: { type: 'string' }, firmaId: { type: 'number' }, hodnota: { type: 'number' },
        pravdepodobnost: { type: 'number' }, platnostOd: { type: 'string' }, popis: { type: 'string' },
        fazeId: { type: 'number' }, vlastnikId: { type: 'number' },
      }, required: ['nazev','firmaId'] },
      handler: async (a) => {
        const body = R.body({ name: a.nazev, company: R.ref(a.firmaId), totalAmount: a.hodnota,
          probability: a.pravdepodobnost, validFrom: a.platnostOd, description: a.popis,
          businessCasePhase: R.ref(a.fazeId), owner: R.ref(a.vlastnikId) });
        const r = await client.put('/businessCase/', body);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ OP "${a.nazev}" vytvořen. ID: ${r.data?.id}`;
      },
    },
    {
      name: 'uprav_op',
      description: 'Upraví obchodní případ včetně volitelných polí.',
      inputSchema: { type: 'object', properties: {
        id: { type: 'number' }, nazev: { type: 'string' }, hodnota: { type: 'number' },
        pravdepodobnost: { type: 'number' }, fazeId: { type: 'number' },
        popis: { type: 'string' }, volitelnaPolea: { type: 'object' },
      }, required: ['id'] },
      handler: async (a) => {
        const body = R.body({ name: a.nazev, totalAmount: a.hodnota, probability: a.pravdepodobnost,
          description: a.popis, businessCasePhase: R.ref(a.fazeId), customFields: a.volitelnaPolea });
        const r = await client.post(`/businessCase/${a.id}/`, body);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ OP ID ${a.id} upraven.`;
      },
    },
    {
      name: 'pridej_polozku_op',
      description: 'Přidá položku do obchodního případu. Správné pole count (ne quantity).',
      inputSchema: { type: 'object', properties: {
        opId: { type: 'number' }, nazev: { type: 'string' }, mnozstvi: { type: 'number' },
        cena: { type: 'number' }, jednotka: { type: 'string' }, dph: { type: 'number' },
        sleva: { type: 'number' }, produktId: { type: 'number' }, popis: { type: 'string' },
      }, required: ['opId','nazev'] },
      handler: async (a) => {
        const body = R.body({ name: a.nazev, count: a.mnozstvi, price: a.cena, unit: a.jednotka,
          taxRate: a.dph, discountPercent: a.sleva, product: R.ref(a.produktId), description: a.popis });
        const r = await client.put(`/businessCase/${a.opId}/item/`, body);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ Položka "${a.nazev}" přidána do OP ${a.opId}.`;
      },
    },
    {
      name: 'volitelna_pole_op',
      description: 'Načte nebo uloží volitelná pole obchodního případu.',
      inputSchema: { type: 'object', properties: {
        opId: { type: 'number' }, pole: { type: 'object' },
      }, required: ['opId'] },
      handler: async (a) => {
        if (a.pole) {
          const r = await client.post(`/businessCase/${a.opId}/`, { customFields: a.pole });
          if (!r.success) return `Chyba: ${r.error}`;
          return `✅ Volitelná pole OP ${a.opId} uložena.`;
        }
        const r = await client.get(`/businessCase/${a.opId}/`);
        if (!r.success) return `Chyba: ${r.error}`;
        const cf = r.data?.customFields || {};
        if (!Object.keys(cf).length) return 'OP nemá vyplněná volitelná pole.';
        return `**Volitelná pole OP:**\n` + Object.entries(cf).filter(([,v]) => v !== null && v !== '').map(([k,v]) => `- ${k}: ${JSON.stringify(v)}`).join('\n');
      },
    },

    // ═══════════════════════════════════════════════════════
    // PRODUKTY - OPRAVENÉ BUGY
    // ═══════════════════════════════════════════════════════
    {
      name: 'seznam_produktu',
      description: 'Vypíše seznam produktů z katalogu.',
      inputSchema: { type: 'object', properties: {
        fulltext: { type: 'string' }, kategorieId: { type: 'number' }, aktivni: { type: 'boolean' },
        limit: { type: 'number', default: 20 }, offset: { type: 'number', default: 0 },
      }},
      handler: async (a) => {
        const p = { limit: a.limit||20, offset: a.offset||0 };
        if (a.fulltext) p['fulltext'] = a.fulltext;
        if (a.kategorieId) p['productCategory[EQ]'] = a.kategorieId;
        if (a.aktivni !== undefined) p['active'] = a.aktivni;
        const r = await client.get('/product/', p);
        if (!r.success) return `Chyba: ${r.error}`;
        const d = Array.isArray(r.data) ? r.data : [];
        if (!d.length) return 'Žádné produkty nenalezeny.';
        return `Nalezeno ${r.totalCount||d.length} produktů:\n\n` +
          d.map(p => `**${p.name}** (Kód: ${p.code||'-'}, ID: ${p.id})\n  Kat: ${p.category?.name||'-'} | Cena: ${p.price||0} Kč | DPH: ${p.taxRate||0}% | Jedn: ${p.unit||'-'}`).join('\n\n');
      },
    },
    {
      name: 'vytvor_produkt',
      description: 'Vytvoří nový produkt. OPRAVENO: správná pole code (povinné) a category (ne categoryId).',
      inputSchema: { type: 'object', properties: {
        kod: { type: 'string', description: 'Kód/SKU (povinné)' },
        nazev: { type: 'string', description: 'Název (povinné)' },
        kategorieId: { type: 'number' }, cena: { type: 'number' }, naklad: { type: 'number' },
        dph: { type: 'number' }, jednotka: { type: 'string' }, popis: { type: 'string' },
      }, required: ['kod','nazev'] },
      handler: async (a) => {
        // OPRAVA: category místo categoryId, code je povinné
        const body = R.body({ code: a.kod, name: a.nazev, category: a.kategorieId,
          price: a.cena, cost: a.naklad, taxRate: a.dph, unit: a.jednotka, description: a.popis });
        const r = await client.put('/product/', body);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ Produkt "${a.nazev}" (kód: ${a.kod}) vytvořen. ID: ${r.data?.id}`;
      },
    },
    {
      name: 'uprav_produkt',
      description: 'Upraví existující produkt.',
      inputSchema: { type: 'object', properties: {
        id: { type: 'number' }, kod: { type: 'string' }, nazev: { type: 'string' },
        kategorieId: { type: 'number' }, cena: { type: 'number' }, dph: { type: 'number' },
        jednotka: { type: 'string' }, popis: { type: 'string' },
      }, required: ['id'] },
      handler: async (a) => {
        const body = R.body({ code: a.kod, name: a.nazev, category: a.kategorieId,
          price: a.cena, taxRate: a.dph, unit: a.jednotka, description: a.popis });
        const r = await client.post(`/product/${a.id}/`, body);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ Produkt ID ${a.id} upraven.`;
      },
    },
    {
      name: 'smaz_produkt',
      description: 'Smaže produkt. POZOR: nevratné!',
      inputSchema: { type: 'object', properties: { id: { type: 'number' } }, required: ['id'] },
      handler: async (a) => {
        const r = await client.del(`/product/${a.id}/`);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ Produkt ID ${a.id} smazán.`;
      },
    },
    {
      name: 'kategorie_produktu',
      description: 'Vypíše kategorie produktů (s ID pro použití při vytváření).',
      inputSchema: { type: 'object', properties: {} },
      handler: async () => {
        const r = await client.get('/productCategory/');
        if (!r.success) return `Chyba: ${r.error}`;
        const d = Array.isArray(r.data) ? r.data : [];
        return `**Kategorie produktů (${d.length}):**\n` + d.map(k => `- ${k.name||k.code01} (ID: ${k.id})`).join('\n');
      },
    },

    // ═══════════════════════════════════════════════════════
    // NABÍDKY - OPRAVENÉ BUGY
    // ═══════════════════════════════════════════════════════
    {
      name: 'seznam_nabidek',
      description: 'Vypíše seznam nabídek.',
      inputSchema: { type: 'object', properties: {
        firmaId: { type: 'number' }, opId: { type: 'number' },
        stav: { type: 'string', enum: ['B_ACTIVE','E_WIN','F_LOST','G_STORNO'] },
        limit: { type: 'number', default: 20 }, offset: { type: 'number', default: 0 },
      }},
      handler: async (a) => {
        const p = { limit: a.limit||20, offset: a.offset||0 };
        if (a.firmaId) p['company[EQ]'] = a.firmaId;
        if (a.opId) p['businessCase[EQ]'] = a.opId;
        if (a.stav) p['offerStatus[EQ]'] = a.stav;
        const r = await client.get('/offer/', p);
        if (!r.success) return `Chyba: ${r.error}`;
        const d = Array.isArray(r.data) ? r.data : [];
        if (!d.length) return 'Žádné nabídky nenalezeny.';
        return `Nalezeno ${r.totalCount||d.length} nabídek:\n\n` +
          d.map(n => `**${n.name}** (ID: ${n.id})\n  Firma: ${n.company?.name||'-'} | Hodnota: ${n.totalAmount||0} Kč | Platnost: ${n.validFrom||'-'} – ${n.validTill||'-'}`).join('\n\n');
      },
    },
    {
      name: 'detail_nabidky',
      description: 'Zobrazí detail nabídky se správným množstvím položek (opravený bug).',
      inputSchema: { type: 'object', properties: { id: { type: 'number' } }, required: ['id'] },
      handler: async (a) => {
        const r = await client.get(`/offer/${a.id}/`);
        if (!r.success) return `Chyba: ${r.error}`;
        const n = r.data;
        let out = `## ${n.name} (ID: ${n.id})\n`;
        out += `- **Firma:** ${n.company?.name||'-'} | **OP:** ${n.businessCase?.name||'-'}\n`;
        out += `- **Hodnota:** ${n.totalAmount||0} Kč | **Platnost:** ${n.validFrom||'-'} – ${n.validTill||'-'}\n`;
        if (n.items?.length) {
          out += `\n**Položky (${n.items.length}):**\n`;
          let celkem = 0;
          n.items.forEach(i => {
            // OPRAVA BUGU #7: count je správné pole pro množství
            const mnozstvi = i.count ?? i.quantity ?? 0;
            const radek = mnozstvi * (i.price||0);
            celkem += radek;
            out += `  - **${i.name}** | ${mnozstvi} ${i.unit||'ks'} × ${i.price||0} Kč = ${radek} Kč\n`;
          });
          out += `\n**Celkem: ${celkem} Kč**\n`;
        }
        return out;
      },
    },
    {
      name: 'vytvor_nabidku',
      description: 'Vytvoří novou nabídku.',
      inputSchema: { type: 'object', properties: {
        nazev: { type: 'string' }, firmaId: { type: 'number' }, opId: { type: 'number' },
        platnostOd: { type: 'string' }, platnostDo: { type: 'string' }, popis: { type: 'string' },
      }, required: ['nazev','firmaId'] },
      handler: async (a) => {
        const body = R.body({ name: a.nazev, company: R.ref(a.firmaId), businessCase: R.ref(a.opId),
          validFrom: a.platnostOd, validTill: a.platnostDo, description: a.popis });
        const r = await client.put('/offer/', body);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ Nabídka "${a.nazev}" vytvořena. ID: ${r.data?.id}`;
      },
    },
    {
      name: 'vytvor_nabidku_s_polozkami',
      description: 'Vytvoří nabídku s položkami najednou. OPRAVENO: count/discountPercent.',
      inputSchema: { type: 'object', properties: {
        nazev: { type: 'string' }, firmaId: { type: 'number' }, opId: { type: 'number' },
        platnostOd: { type: 'string' }, platnostDo: { type: 'string' },
        polozky: { type: 'array', items: { type: 'object', properties: {
          nazev: { type: 'string' }, mnozstvi: { type: 'number' }, cena: { type: 'number' },
          jednotka: { type: 'string' }, dph: { type: 'number' }, sleva: { type: 'number' },
          produktId: { type: 'number' }, popis: { type: 'string' },
        }, required: ['nazev'] }},
      }, required: ['nazev','firmaId'] },
      handler: async (a) => {
        const polozky = (a.polozky||[]).map(p => R.body({
          name: p.nazev, count: p.mnozstvi, price: p.cena, unit: p.jednotka,
          taxRate: p.dph, discountPercent: p.sleva, product: R.ref(p.produktId), description: p.popis,
        }));
        const body = R.body({ name: a.nazev, company: R.ref(a.firmaId), businessCase: R.ref(a.opId),
          validFrom: a.platnostOd, validTill: a.platnostDo,
          items: polozky.length ? polozky : undefined });
        const r = await client.put('/offer/createWithItems', body);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ Nabídka "${a.nazev}" s ${polozky.length} položkami vytvořena. ID: ${r.data?.id}`;
      },
    },
    {
      name: 'pridej_polozku_nabidky',
      description: 'Přidá položku do nabídky. OPRAVENO: count místo quantity, discountPercent místo discount.',
      inputSchema: { type: 'object', properties: {
        nabidkaId: { type: 'number' }, nazev: { type: 'string' }, mnozstvi: { type: 'number' },
        cena: { type: 'number' }, jednotka: { type: 'string' }, dph: { type: 'number' },
        sleva: { type: 'number' }, produktId: { type: 'number' }, popis: { type: 'string' },
      }, required: ['nabidkaId','nazev'] },
      handler: async (a) => {
        const body = R.body({ name: a.nazev, count: a.mnozstvi, price: a.cena, unit: a.jednotka,
          taxRate: a.dph, discountPercent: a.sleva, product: R.ref(a.produktId), description: a.popis });
        const r = await client.put(`/offer/${a.nabidkaId}/item/`, body);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ Položka "${a.nazev}" přidána do nabídky ${a.nabidkaId}.`;
      },
    },

    // ═══════════════════════════════════════════════════════
    // AKTIVITY
    // ═══════════════════════════════════════════════════════
    {
      name: 'vytvor_ukol',
      description: 'Vytvoří nový úkol.',
      inputSchema: { type: 'object', properties: {
        nazev: { type: 'string' }, termin: { type: 'string' },
        priorita: { type: 'string', enum: ['HIGH','NORMAL','LOW'] },
        firmaId: { type: 'number' }, opId: { type: 'number' }, popis: { type: 'string' }, vlastnikId: { type: 'number' },
      }, required: ['nazev'] },
      handler: async (a) => {
        const body = R.body({ title: a.nazev, deadline: a.termin, priority: a.priorita||'NORMAL',
          company: R.ref(a.firmaId), businessCase: R.ref(a.opId), description: a.popis, owner: R.ref(a.vlastnikId) });
        const r = await client.put('/task/', body);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ Úkol "${a.nazev}" vytvořen. ID: ${r.data?.id}`;
      },
    },
    {
      name: 'vytvor_schuzku',
      description: 'Vytvoří novou schůzku.',
      inputSchema: { type: 'object', properties: {
        nazev: { type: 'string' }, od: { type: 'string' }, do: { type: 'string' },
        firmaId: { type: 'number' }, opId: { type: 'number' }, popis: { type: 'string' }, vlastnikId: { type: 'number' },
      }, required: ['nazev'] },
      handler: async (a) => {
        const body = R.body({ title: a.nazev, scheduledFrom: a.od, scheduledTill: a.do, priority: 'NORMAL',
          company: R.ref(a.firmaId), businessCase: R.ref(a.opId), description: a.popis, owner: R.ref(a.vlastnikId) });
        const r = await client.put('/meeting/', body);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ Schůzka "${a.nazev}" vytvořena. ID: ${r.data?.id}`;
      },
    },
    {
      name: 'vytvor_telefonat',
      description: 'Zaznamená telefonát.',
      inputSchema: { type: 'object', properties: {
        nazev: { type: 'string' }, od: { type: 'string' },
        firmaId: { type: 'number' }, kontaktId: { type: 'number' }, opId: { type: 'number' },
        popis: { type: 'string' }, reseni: { type: 'string' }, vlastnikId: { type: 'number' },
      }, required: ['nazev'] },
      handler: async (a) => {
        const body = R.body({ title: a.nazev, scheduledFrom: a.od, priority: 'NORMAL',
          company: R.ref(a.firmaId), person: R.ref(a.kontaktId), businessCase: R.ref(a.opId),
          description: a.popis, solution: a.reseni, owner: R.ref(a.vlastnikId) });
        const r = await client.put('/phoneCall/', body);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ Telefonát "${a.nazev}" zaznamenán. ID: ${r.data?.id}`;
      },
    },

    // ═══════════════════════════════════════════════════════
    // LEADY
    // ═══════════════════════════════════════════════════════
    {
      name: 'seznam_leadu',
      description: 'Vypíše seznam leadů.',
      inputSchema: { type: 'object', properties: {
        fulltext: { type: 'string' }, limit: { type: 'number', default: 20 }, offset: { type: 'number', default: 0 },
      }},
      handler: async (a) => {
        const p = { limit: a.limit||20, offset: a.offset||0 };
        if (a.fulltext) p['fulltext'] = a.fulltext;
        const r = await client.get('/lead/', p);
        if (!r.success) return `Chyba: ${r.error}`;
        const d = Array.isArray(r.data) ? r.data : [];
        if (!d.length) return 'Žádné leady nenalezeny.';
        return d.map(l => `**${l.topic}** (ID: ${l.id})\n  Firma: ${l.companyName||'-'} | Fáze: ${l.leadPhase?.name||'-'}`).join('\n\n');
      },
    },
    {
      name: 'vytvor_lead',
      description: 'Vytvoří nový lead.',
      inputSchema: { type: 'object', properties: {
        tema: { type: 'string' }, priorita: { type: 'string', enum: ['HIGH','NORMAL','LOW'] },
        firmaJmeno: { type: 'string' }, jmeno: { type: 'string' }, prijmeni: { type: 'string' },
        email: { type: 'string' }, telefon: { type: 'string' }, poznamka: { type: 'string' },
      }, required: ['tema','priorita'] },
      handler: async (a) => {
        const body = R.body({ topic: a.tema, priority: a.priorita, companyName: a.firmaJmeno,
          firstName: a.jmeno, lastName: a.prijmeni, notice: a.poznamka,
          contactInfo: (a.email||a.telefon) ? {
            email: a.email ? [{email: a.email}] : undefined,
            tel: a.telefon ? [{tel: a.telefon}] : undefined,
          } : undefined });
        const r = await client.put('/lead/', body);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ Lead "${a.tema}" vytvořen. ID: ${r.data?.id}`;
      },
    },

    // ═══════════════════════════════════════════════════════
    // PROJEKTY & OBJEDNÁVKY
    // ═══════════════════════════════════════════════════════
    {
      name: 'seznam_projektu',
      description: 'Vypíše seznam projektů.',
      inputSchema: { type: 'object', properties: {
        firmaId: { type: 'number' }, stav: { type: 'string', enum: ['A_DRAFT','B_ACTIVE','C_FINISHED','D_CANCELLED'] },
        limit: { type: 'number', default: 20 }, offset: { type: 'number', default: 0 },
      }},
      handler: async (a) => {
        const p = { limit: a.limit||20, offset: a.offset||0 };
        if (a.firmaId) p['company[EQ]'] = a.firmaId;
        if (a.stav) p['projectStatus[EQ]'] = a.stav;
        const r = await client.get('/project/', p);
        if (!r.success) return `Chyba: ${r.error}`;
        const d = Array.isArray(r.data) ? r.data : [];
        if (!d.length) return 'Žádné projekty nenalezeny.';
        return d.map(p => `**${p.name}** (ID: ${p.id})\n  Firma: ${p.company?.name||'-'} | Stav: ${p.projectStatus?.name||'-'}`).join('\n\n');
      },
    },
    {
      name: 'vytvor_objednavku_z_nabidky',
      description: 'Vytvoří objednávku z existující nabídky.',
      inputSchema: { type: 'object', properties: {
        nabidkaId: { type: 'number' }, datumObjednavky: { type: 'string' }, datumDodani: { type: 'string' },
      }, required: ['nabidkaId'] },
      handler: async (a) => {
        const body = R.body({ offer: R.ref(a.nabidkaId), validFrom: a.datumObjednavky, requestDeliveryDate: a.datumDodani });
        const r = await client.put('/salesOrder/', body);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ Objednávka z nabídky ID ${a.nabidkaId} vytvořena. ID: ${r.data?.id}`;
      },
    },

    // ═══════════════════════════════════════════════════════
    // ČÍSELNÍKY & VOLITELNÁ POLE
    // ═══════════════════════════════════════════════════════
    {
      name: 'faze_op',
      description: 'Vypíše fáze obchodních případů s ID.',
      inputSchema: { type: 'object', properties: {} },
      handler: async () => {
        const r = await client.get('/businessCasePhase/');
        if (!r.success) return `Chyba: ${r.error}`;
        const d = Array.isArray(r.data) ? r.data : [];
        return `**Fáze OP:**\n` + d.map(f => `- ${f.name||f.code01} (ID: ${f.id}, pravd: ${f.probability||0}%)`).join('\n');
      },
    },
    {
      name: 'uzivatele',
      description: 'Vypíše uživatele Raynetu (pro přiřazování vlastníků).',
      inputSchema: { type: 'object', properties: {} },
      handler: async () => {
        const r = await client.get('/userAccount/');
        if (!r.success) return `Chyba: ${r.error}`;
        const d = Array.isArray(r.data) ? r.data : [];
        return `**Uživatelé (${d.length}):**\n` + d.map(u => `- ${u.fullName||u.login} (ID: ${u.id})`).join('\n');
      },
    },
    {
      name: 'meny',
      description: 'Vypíše dostupné měny. OPRAVENO: správné mapování názvů.',
      inputSchema: { type: 'object', properties: {} },
      handler: async () => {
        const r = await client.get('/currency/');
        if (!r.success) return `Chyba: ${r.error}`;
        const d = Array.isArray(r.data) ? r.data : [];
        return `**Měny:**\n` + d.map(m => `- ${m.name||m.code01||'N/A'} (kód: ${m.code02||m.code01||'-'}, ID: ${m.id})`).join('\n');
      },
    },
    {
      name: 'konfigurace_volitelnych_poli',
      description: 'Zobrazí konfiguraci volitelných polí (záložka Vlastní pole) pro danou entitu.',
      inputSchema: { type: 'object', properties: {
        entita: { type: 'string', enum: ['company','person','businessCase','offer','salesOrder','project','lead','product'],
          description: 'Typ entity anglicky' },
      }, required: ['entita'] },
      handler: async (a) => {
        const r = await client.get('/customField/config/', { entity: a.entita });
        if (!r.success) return `Chyba: ${r.error}`;
        const d = Array.isArray(r.data) ? r.data : [];
        if (!d.length) return `Entita "${a.entita}" nemá žádná volitelná pole.`;
        return `**Volitelná pole entity "${a.entita}" (${d.length}):**\n\n` +
          d.map(p => `**${p.label}** (klíč: ${p.fieldName||p.name||'-'}, typ: ${p.dataType||'-'})\n  Skupina: ${p.groupName||'-'}`).join('\n\n');
      },
    },
    {
      name: 'uloz_volitelna_pole',
      description: 'Uloží hodnoty volitelných polí pro libovolný záznam.',
      inputSchema: { type: 'object', properties: {
        entita: { type: 'string', enum: ['company','person','businessCase','offer','salesOrder','project','lead'] },
        id: { type: 'number' }, pole: { type: 'object' },
      }, required: ['entita','id','pole'] },
      handler: async (a) => {
        const r = await client.post(`/${a.entita}/${a.id}/`, { customFields: a.pole });
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ Volitelná pole záznamu ID ${a.id} uložena.`;
      },
    },
    {
      name: 'pridej_komentar',
      description: 'Přidá komentář k záznamu.',
      inputSchema: { type: 'object', properties: {
        entita: { type: 'string', enum: ['company','person','businessCase','offer','project','lead'] },
        zaznamId: { type: 'number' }, komentar: { type: 'string' },
      }, required: ['entita','zaznamId','komentar'] },
      handler: async (a) => {
        const r = await client.put(`/${a.entita}/${a.zaznamId}/post/`, { comment: a.komentar });
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ Komentář přidán.`;
      },
    },
    {
      name: 'pridej_tag',
      description: 'Přidá tag k záznamu.',
      inputSchema: { type: 'object', properties: {
        entita: { type: 'string', enum: ['company','person','businessCase','offer','project','lead'] },
        zaznamId: { type: 'number' }, tag: { type: 'string' },
      }, required: ['entita','zaznamId','tag'] },
      handler: async (a) => {
        const r = await client.put(`/${a.entita}/${a.zaznamId}/tag/`, { tag: a.tag });
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ Tag "${a.tag}" přidán.`;
      },
    },
    {
      name: 'changelog_fazi_op',
      description: 'Zobrazí historii změn fází obchodního případu.',
      inputSchema: { type: 'object', properties: { opId: { type: 'number' } }, required: ['opId'] },
      handler: async (a) => {
        const r = await client.get(`/businessCase/${a.opId}/phaseChanges`);
        if (!r.success) return `Chyba: ${r.error}`;
        const d = Array.isArray(r.data) ? r.data : [];
        if (!d.length) return 'Žádné změny fází.';
        return `**Historie fází OP ${a.opId}:**\n` +
          d.map(z => `${z.changedAt||'-'}: ${z.oldPhase?.name||'-'} → **${z.newPhase?.name||'-'}** (${z.changedBy?.fullName||'-'})`).join('\n');
      },
    },
  ];
}

module.exports = { tools };
