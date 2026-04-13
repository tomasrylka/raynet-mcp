// src/tools.js — MAXIMÁLNÍ verze, kompletní pokrytí Raynet CRM API
'use strict';

const { RaynetClient: C } = require('./client');

// Helper pro generické picklist nástroje
function picklist(client, path, label) {
  return {
    seznam: {
      handler: async () => {
        const r = await client.get(`/${path}/`);
        if (!r.success) return `Chyba: ${r.error}`;
        const d = Array.isArray(r.data) ? r.data : [];
        if (!d.length) return `${label}: žádné záznamy.`;
        return `**${label}:**\n` + d.map(x => `- ${x.name||x.code01||'-'} (ID: ${x.id})`).join('\n');
      }
    },
    vytvor: {
      handler: async (a) => {
        const r = await client.put(`/${path}/`, { name: a.nazev });
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ ${label} "${a.nazev}" vytvořen/a. ID: ${r.data?.id}`;
      }
    },
    uprav: {
      handler: async (a) => {
        const r = await client.post(`/${path}/${a.id}/`, { name: a.nazev });
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ ${label} ID ${a.id} upraven/a.`;
      }
    },
    smaz: {
      handler: async (a) => {
        const r = await client.del(`/${path}/${a.id}/`);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ ${label} ID ${a.id} smazán/a.`;
      }
    }
  };
}

function tools(client) {
  const R = C;

  return [

    // ═══════════════════════════════════════════════════════════════
    // FIRMY (Accounts)
    // ═══════════════════════════════════════════════════════════════
    {
      name: 'seznam_firem',
      description: 'Vypíše seznam firem s filtrováním. Podporuje fulltext, stav, roli, rating, vlastníka.',
      inputSchema: { type: 'object', properties: {
        fulltext: { type: 'string' },
        stav: { type: 'string', enum: ['A_POTENTIAL','B_ACTUAL','C_DEFERRED','D_ENDED','D_UNATTRACTIVE'] },
        role: { type: 'string', enum: ['A_SUBSCRIBER','B_PARTNER','C_SUPPLIER','D_RIVAL'] },
        rating: { type: 'string', enum: ['A','B','C'] },
        vlastnikId: { type: 'number' },
        limit: { type: 'number', default: 20 },
        offset: { type: 'number', default: 0 },
      }},
      handler: async (a) => {
        const p = { limit: a.limit||20, offset: a.offset||0 };
        if (a.fulltext) p.fulltext = a.fulltext;
        if (a.stav) p['state[EQ]'] = a.stav;
        if (a.role) p['role[EQ]'] = a.role;
        if (a.rating) p['rating[EQ]'] = a.rating;
        if (a.vlastnikId) p['owner[EQ]'] = a.vlastnikId;
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
      description: 'Kompletní detail firmy včetně adres, volitelných polí a kontaktních informací.',
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
          f.addresses.forEach(addr => out += `  - [${addr.type||'-'}] ${addr.street||''} ${addr.city||''} ${addr.zipCode||''}\n`);
        }
        if (f.customFields && Object.keys(f.customFields).length) {
          out += `\n**Volitelná pole:**\n`;
          for (const [k,v] of Object.entries(f.customFields))
            if (v !== null && v !== '') out += `  - ${k}: ${JSON.stringify(v)}\n`;
        }
        return out;
      },
    },
    {
      name: 'detail_firmy_dle_ext_id',
      description: 'Zobrazí detail firmy podle externího ID.',
      inputSchema: { type: 'object', properties: { extId: { type: 'string' } }, required: ['extId'] },
      handler: async (a) => {
        const r = await client.get(`/company/ext/${a.extId}/`);
        if (!r.success) return `Chyba: ${r.error}`;
        const f = r.data;
        return `**${f.name}** (ID: ${f.id})\n- IČO: ${f.regNumber||'-'} | Stav: ${f.state?.code||'-'}`;
      },
    },
    {
      name: 'vytvor_firmu',
      description: 'Vytvoří novou firmu.',
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
          regNumber: a.ico, taxNumber: a.dic, notice: a.poznamka, owner: R.ref(a.vlastnikId),
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
      description: 'Upraví existující firmu.',
      inputSchema: { type: 'object', properties: {
        id: { type: 'number' }, nazev: { type: 'string' }, rating: { type: 'string', enum: ['A','B','C'] },
        stav: { type: 'string' }, ico: { type: 'string' }, dic: { type: 'string' },
        poznamka: { type: 'string' }, vlastnikId: { type: 'number' }, volitelnaPolea: { type: 'object' },
      }, required: ['id'] },
      handler: async (a) => {
        const body = R.body({ name: a.nazev, rating: a.rating, state: a.stav,
          regNumber: a.ico, taxNumber: a.dic, notice: a.poznamka,
          owner: R.ref(a.vlastnikId), customFields: a.volitelnaPolea });
        const r = await client.post(`/company/${a.id}/`, body);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ Firma ID ${a.id} upravena.`;
      },
    },
    {
      name: 'smaz_firmu',
      description: 'Smaže firmu.',
      inputSchema: { type: 'object', properties: { id: { type: 'number' } }, required: ['id'] },
      handler: async (a) => {
        const r = await client.del(`/company/${a.id}/`);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ Firma ID ${a.id} smazána.`;
      },
    },
    {
      name: 'zamkni_firmu',
      description: 'Zamkne firmu (zabrání úpravám).',
      inputSchema: { type: 'object', properties: { id: { type: 'number' } }, required: ['id'] },
      handler: async (a) => {
        const r = await client.post(`/company/${a.id}/lock`);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ Firma ID ${a.id} zamčena.`;
      },
    },
    {
      name: 'odemkni_firmu',
      description: 'Odemkne firmu.',
      inputSchema: { type: 'object', properties: { id: { type: 'number' } }, required: ['id'] },
      handler: async (a) => {
        const r = await client.post(`/company/${a.id}/unlock`);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ Firma ID ${a.id} odemčena.`;
      },
    },
    {
      name: 'zneplatnit_firmu',
      description: 'Označí firmu jako neplatnou (archivace).',
      inputSchema: { type: 'object', properties: { id: { type: 'number' } }, required: ['id'] },
      handler: async (a) => {
        const r = await client.post(`/company/${a.id}/invalid`);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ Firma ID ${a.id} zneplatněna.`;
      },
    },
    {
      name: 'obnovit_firmu',
      description: 'Obnoví platnost firmy.',
      inputSchema: { type: 'object', properties: { id: { type: 'number' } }, required: ['id'] },
      handler: async (a) => {
        const r = await client.post(`/company/${a.id}/valid`);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ Firma ID ${a.id} obnovena.`;
      },
    },
    {
      name: 'anonymizovat_firmu',
      description: 'GDPR anonymizace firmy — nevratná operace.',
      inputSchema: { type: 'object', properties: { id: { type: 'number' } }, required: ['id'] },
      handler: async (a) => {
        const r = await client.post(`/company/${a.id}/anonymize/`);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ Firma ID ${a.id} anonymizována.`;
      },
    },
    {
      name: 'sloucit_firmy',
      description: 'Sloučí duplicitní firmy — zdrojová se sloučí do cílové.',
      inputSchema: { type: 'object', properties: {
        cilId: { type: 'number', description: 'ID cílové firmy (výsledná)' },
        zdrojId: { type: 'number', description: 'ID zdrojové firmy (bude smazána)' },
      }, required: ['cilId','zdrojId'] },
      handler: async (a) => {
        const r = await client.post(`/company/${a.cilId}/merge/${a.zdrojId}/`);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ Firmy sloučeny. Firma ID ${a.zdrojId} sloučena do ID ${a.cilId}.`;
      },
    },
    {
      name: 'pridej_adresu_firmy',
      description: 'Přidá adresu k firmě.',
      inputSchema: { type: 'object', properties: {
        firmaId: { type: 'number' }, ulice: { type: 'string' }, mesto: { type: 'string' },
        psc: { type: 'string' }, zeme: { type: 'string' },
        typ: { type: 'string', enum: ['DELIVERY','INVOICING','OTHER'] },
      }, required: ['firmaId','mesto'] },
      handler: async (a) => {
        const body = R.body({ street: a.ulice, city: a.mesto, zipCode: a.psc, country: a.zeme, type: a.typ||'OTHER' });
        const r = await client.put(`/company/${a.firmaId}/address/`, body);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ Adresa přidána k firmě ID ${a.firmaId}. ID adresy: ${r.data?.id}`;
      },
    },
    {
      name: 'uprav_adresu_firmy',
      description: 'Upraví adresu firmy.',
      inputSchema: { type: 'object', properties: {
        firmaId: { type: 'number' }, adresaId: { type: 'number' },
        ulice: { type: 'string' }, mesto: { type: 'string' }, psc: { type: 'string' },
      }, required: ['firmaId','adresaId'] },
      handler: async (a) => {
        const body = R.body({ street: a.ulice, city: a.mesto, zipCode: a.psc });
        const r = await client.post(`/company/${a.firmaId}/address/${a.adresaId}/`, body);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ Adresa ID ${a.adresaId} upravena.`;
      },
    },
    {
      name: 'smaz_adresu_firmy',
      description: 'Smaže adresu firmy.',
      inputSchema: { type: 'object', properties: {
        firmaId: { type: 'number' }, adresaId: { type: 'number' },
      }, required: ['firmaId','adresaId'] },
      handler: async (a) => {
        const r = await client.del(`/company/${a.firmaId}/address/${a.adresaId}/`);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ Adresa ID ${a.adresaId} smazána.`;
      },
    },
    {
      name: 'nastav_primarni_adresu_firmy',
      description: 'Nastaví adresu jako primární u firmy.',
      inputSchema: { type: 'object', properties: {
        firmaId: { type: 'number' }, adresaId: { type: 'number' },
      }, required: ['firmaId','adresaId'] },
      handler: async (a) => {
        const r = await client.post(`/company/${a.firmaId}/address/${a.adresaId}/setPrimary/`);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ Adresa ID ${a.adresaId} nastavena jako primární.`;
      },
    },
    {
      name: 'vztahy_firmy',
      description: 'Zobrazí vztahy firmy k jiným firmám.',
      inputSchema: { type: 'object', properties: { firmaId: { type: 'number' } }, required: ['firmaId'] },
      handler: async (a) => {
        const r = await client.get(`/company/${a.firmaId}/relationship/`);
        if (!r.success) return `Chyba: ${r.error}`;
        const d = Array.isArray(r.data) ? r.data : [];
        if (!d.length) return 'Firma nemá žádné vztahy.';
        return `**Vztahy firmy ID ${a.firmaId}:**\n` +
          d.map(v => `- ${v.relatedCompany?.name||'-'} (${v.type?.name||'-'}, ID vztahu: ${v.id})`).join('\n');
      },
    },
    {
      name: 'pridej_vztah_firmy',
      description: 'Přidá vztah mezi dvěma firmami.',
      inputSchema: { type: 'object', properties: {
        firmaId: { type: 'number' }, souvisejiciFirmaId: { type: 'number' }, typ: { type: 'string' },
      }, required: ['firmaId','souvisejiciFirmaId'] },
      handler: async (a) => {
        const body = R.body({ relatedCompany: R.ref(a.souvisejiciFirmaId), type: a.typ });
        const r = await client.put(`/company/${a.firmaId}/relationship/`, body);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ Vztah přidán.`;
      },
    },
    {
      name: 'smaz_vztah_firmy',
      description: 'Smaže vztah firmy.',
      inputSchema: { type: 'object', properties: {
        firmaId: { type: 'number' }, vztahId: { type: 'number' },
      }, required: ['firmaId','vztahId'] },
      handler: async (a) => {
        const r = await client.del(`/company/${a.firmaId}/relationship/${a.vztahId}/`);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ Vztah ID ${a.vztahId} smazán.`;
      },
    },
    {
      name: 'ceniky_firmy',
      description: 'Zobrazí ceníky přiřazené k firmě.',
      inputSchema: { type: 'object', properties: { firmaId: { type: 'number' } }, required: ['firmaId'] },
      handler: async (a) => {
        const r = await client.get(`/company/${a.firmaId}/priceList/`);
        if (!r.success) return `Chyba: ${r.error}`;
        const d = Array.isArray(r.data) ? r.data : [];
        if (!d.length) return 'Firmě nejsou přiřazeny žádné ceníky.';
        return `**Ceníky firmy ID ${a.firmaId}:**\n` + d.map(c => `- ${c.name} (ID: ${c.id})`).join('\n');
      },
    },
    {
      name: 'volitelna_pole_firmy',
      description: 'Načte nebo uloží volitelná pole firmy.',
      inputSchema: { type: 'object', properties: { firmaId: { type: 'number' }, pole: { type: 'object' } }, required: ['firmaId'] },
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

    // ═══════════════════════════════════════════════════════════════
    // KONTAKTY (Persons)
    // ═══════════════════════════════════════════════════════════════
    {
      name: 'seznam_kontaktu',
      description: 'Vypíše seznam kontaktních osob.',
      inputSchema: { type: 'object', properties: {
        fulltext: { type: 'string' }, firmaId: { type: 'number' },
        limit: { type: 'number', default: 20 }, offset: { type: 'number', default: 0 },
      }},
      handler: async (a) => {
        const p = { limit: a.limit||20, offset: a.offset||0 };
        if (a.fulltext) p.fulltext = a.fulltext;
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
      name: 'detail_kontaktu',
      description: 'Kompletní detail kontaktní osoby.',
      inputSchema: { type: 'object', properties: { id: { type: 'number' } }, required: ['id'] },
      handler: async (a) => {
        const r = await client.get(`/person/${a.id}/`);
        if (!r.success) return `Chyba: ${r.error}`;
        const k = r.data;
        let out = `## ${k.firstName||''} ${k.lastName||''} (ID: ${k.id})\n`;
        out += `- **Firma:** ${k.company?.name||'-'} | **Pozice:** ${k.position||'-'}\n`;
        out += `- **Email:** ${k.primaryEmail||'-'} | **Tel:** ${k.primaryPhone||'-'}\n`;
        out += `- **Vlastník:** ${k.owner?.fullName||'-'}\n`;
        if (k.customFields && Object.keys(k.customFields).length) {
          out += `\n**Volitelná pole:**\n`;
          for (const [key,v] of Object.entries(k.customFields))
            if (v !== null && v !== '') out += `  - ${key}: ${JSON.stringify(v)}\n`;
        }
        return out;
      },
    },
    {
      name: 'detail_kontaktu_dle_ext_id',
      description: 'Zobrazí detail kontaktu podle externího ID.',
      inputSchema: { type: 'object', properties: { extId: { type: 'string' } }, required: ['extId'] },
      handler: async (a) => {
        const r = await client.get(`/person/ext/${a.extId}/`);
        if (!r.success) return `Chyba: ${r.error}`;
        const k = r.data;
        return `**${k.firstName||''} ${k.lastName||''}** (ID: ${k.id})\n- Firma: ${k.company?.name||'-'}`;
      },
    },
    {
      name: 'vytvor_kontakt',
      description: 'Vytvoří novou kontaktní osobu.',
      inputSchema: { type: 'object', properties: {
        prijmeni: { type: 'string' }, jmeno: { type: 'string' },
        firmaId: { type: 'number' }, pozice: { type: 'string' },
        telefon: { type: 'string' }, email: { type: 'string' },
        poznamka: { type: 'string' }, vlastnikId: { type: 'number' },
      }, required: ['prijmeni'] },
      handler: async (a) => {
        const body = R.body({
          lastName: a.prijmeni, firstName: a.jmeno, position: a.pozice,
          notice: a.poznamka, owner: R.ref(a.vlastnikId),
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
    {
      name: 'uprav_kontakt',
      description: 'Upraví kontaktní osobu.',
      inputSchema: { type: 'object', properties: {
        id: { type: 'number' }, prijmeni: { type: 'string' }, jmeno: { type: 'string' },
        pozice: { type: 'string' }, poznamka: { type: 'string' },
        vlastnikId: { type: 'number' }, volitelnaPolea: { type: 'object' },
      }, required: ['id'] },
      handler: async (a) => {
        const body = R.body({ lastName: a.prijmeni, firstName: a.jmeno, position: a.pozice,
          notice: a.poznamka, owner: R.ref(a.vlastnikId), customFields: a.volitelnaPolea });
        const r = await client.post(`/person/${a.id}/`, body);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ Kontakt ID ${a.id} upraven.`;
      },
    },
    {
      name: 'smaz_kontakt',
      description: 'Smaže kontaktní osobu.',
      inputSchema: { type: 'object', properties: { id: { type: 'number' } }, required: ['id'] },
      handler: async (a) => {
        const r = await client.del(`/person/${a.id}/`);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ Kontakt ID ${a.id} smazán.`;
      },
    },
    {
      name: 'zamkni_kontakt',
      description: 'Zamkne kontaktní osobu.',
      inputSchema: { type: 'object', properties: { id: { type: 'number' } }, required: ['id'] },
      handler: async (a) => {
        const r = await client.post(`/person/${a.id}/lock`);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ Kontakt ID ${a.id} zamčen.`;
      },
    },
    {
      name: 'odemkni_kontakt',
      description: 'Odemkne kontaktní osobu.',
      inputSchema: { type: 'object', properties: { id: { type: 'number' } }, required: ['id'] },
      handler: async (a) => {
        const r = await client.post(`/person/${a.id}/unlock`);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ Kontakt ID ${a.id} odemčen.`;
      },
    },
    {
      name: 'zneplatnit_kontakt',
      description: 'Označí kontakt jako neplatný.',
      inputSchema: { type: 'object', properties: { id: { type: 'number' } }, required: ['id'] },
      handler: async (a) => {
        const r = await client.post(`/person/${a.id}/invalid`);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ Kontakt ID ${a.id} zneplatněn.`;
      },
    },
    {
      name: 'obnovit_kontakt',
      description: 'Obnoví platnost kontaktu.',
      inputSchema: { type: 'object', properties: { id: { type: 'number' } }, required: ['id'] },
      handler: async (a) => {
        const r = await client.post(`/person/${a.id}/valid`);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ Kontakt ID ${a.id} obnoven.`;
      },
    },
    {
      name: 'anonymizovat_kontakt',
      description: 'GDPR anonymizace kontaktu — nevratná operace.',
      inputSchema: { type: 'object', properties: { id: { type: 'number' } }, required: ['id'] },
      handler: async (a) => {
        const r = await client.post(`/person/${a.id}/anonymize/`);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ Kontakt ID ${a.id} anonymizován.`;
      },
    },
    {
      name: 'sloucit_kontakty',
      description: 'Sloučí duplicitní kontakty.',
      inputSchema: { type: 'object', properties: {
        cilId: { type: 'number', description: 'ID cílového kontaktu' },
        zdrojId: { type: 'number', description: 'ID zdrojového kontaktu (bude smazán)' },
      }, required: ['cilId','zdrojId'] },
      handler: async (a) => {
        const r = await client.post(`/person/${a.cilId}/merge/${a.zdrojId}/`);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ Kontakty sloučeny.`;
      },
    },
    {
      name: 'pridej_vztah_kontaktu',
      description: 'Přidá vztah kontaktu k firmě.',
      inputSchema: { type: 'object', properties: {
        kontaktId: { type: 'number' }, firmaId: { type: 'number' },
        typ: { type: 'string', description: 'Typ vztahu, např. EMPLOYEE' },
      }, required: ['kontaktId','firmaId'] },
      handler: async (a) => {
        const body = R.body({ company: R.ref(a.firmaId), type: a.typ||'EMPLOYEE' });
        const r = await client.put(`/person/${a.kontaktId}/relationship/`, body);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ Vztah přidán.`;
      },
    },
    {
      name: 'smaz_vztah_kontaktu',
      description: 'Smaže vztah kontaktu k firmě.',
      inputSchema: { type: 'object', properties: {
        kontaktId: { type: 'number' }, vztahId: { type: 'number' },
      }, required: ['kontaktId','vztahId'] },
      handler: async (a) => {
        const r = await client.del(`/person/${a.kontaktId}/relationship/${a.vztahId}/`);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ Vztah ID ${a.vztahId} smazán.`;
      },
    },

    // ═══════════════════════════════════════════════════════════════
    // LEADY
    // ═══════════════════════════════════════════════════════════════
    {
      name: 'seznam_leadu',
      description: 'Vypíše seznam leadů.',
      inputSchema: { type: 'object', properties: {
        fulltext: { type: 'string' }, limit: { type: 'number', default: 20 }, offset: { type: 'number', default: 0 },
      }},
      handler: async (a) => {
        const p = { limit: a.limit||20, offset: a.offset||0 };
        if (a.fulltext) p.fulltext = a.fulltext;
        const r = await client.get('/lead/', p);
        if (!r.success) return `Chyba: ${r.error}`;
        const d = Array.isArray(r.data) ? r.data : [];
        if (!d.length) return 'Žádné leady nenalezeny.';
        return `Nalezeno ${r.totalCount||d.length} leadů:\n\n` +
          d.map(l => `**${l.topic}** (ID: ${l.id})\n  Firma: ${l.companyName||'-'} | Fáze: ${l.leadPhase?.name||'-'} | Priorita: ${l.priority||'-'}`).join('\n\n');
      },
    },
    {
      name: 'detail_leadu',
      description: 'Zobrazí detail leadu.',
      inputSchema: { type: 'object', properties: { id: { type: 'number' } }, required: ['id'] },
      handler: async (a) => {
        const r = await client.get(`/lead/${a.id}/`);
        if (!r.success) return `Chyba: ${r.error}`;
        const l = r.data;
        let out = `## ${l.topic} (ID: ${l.id})\n`;
        out += `- **Firma:** ${l.companyName||'-'} | **Kontakt:** ${l.firstName||''} ${l.lastName||''}\n`;
        out += `- **Fáze:** ${l.leadPhase?.name||'-'} | **Priorita:** ${l.priority||'-'}\n`;
        out += `- **Email:** ${l.primaryEmail||'-'} | **Tel:** ${l.primaryPhone||'-'}\n`;
        if (l.notice) out += `- **Poznámka:** ${l.notice}\n`;
        return out;
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
    {
      name: 'uprav_lead',
      description: 'Upraví existující lead.',
      inputSchema: { type: 'object', properties: {
        id: { type: 'number' }, tema: { type: 'string' }, priorita: { type: 'string' },
        poznamka: { type: 'string' }, volitelnaPolea: { type: 'object' },
      }, required: ['id'] },
      handler: async (a) => {
        const body = R.body({ topic: a.tema, priority: a.priorita, notice: a.poznamka, customFields: a.volitelnaPolea });
        const r = await client.post(`/lead/${a.id}/`, body);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ Lead ID ${a.id} upraven.`;
      },
    },
    {
      name: 'smaz_lead',
      description: 'Smaže lead.',
      inputSchema: { type: 'object', properties: { id: { type: 'number' } }, required: ['id'] },
      handler: async (a) => {
        const r = await client.del(`/lead/${a.id}/`);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ Lead ID ${a.id} smazán.`;
      },
    },
    {
      name: 'zamkni_lead',
      description: 'Zamkne lead.',
      inputSchema: { type: 'object', properties: { id: { type: 'number' } }, required: ['id'] },
      handler: async (a) => {
        const r = await client.post(`/lead/${a.id}/lock`);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ Lead ID ${a.id} zamčen.`;
      },
    },
    {
      name: 'odemkni_lead',
      description: 'Odemkne lead.',
      inputSchema: { type: 'object', properties: { id: { type: 'number' } }, required: ['id'] },
      handler: async (a) => {
        const r = await client.post(`/lead/${a.id}/unlock`);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ Lead ID ${a.id} odemčen.`;
      },
    },
    {
      name: 'anonymizovat_lead',
      description: 'GDPR anonymizace leadu.',
      inputSchema: { type: 'object', properties: { id: { type: 'number' } }, required: ['id'] },
      handler: async (a) => {
        const r = await client.post(`/lead/${a.id}/anonymize/`);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ Lead ID ${a.id} anonymizován.`;
      },
    },
    {
      name: 'sloucit_leady',
      description: 'Sloučí duplicitní leady.',
      inputSchema: { type: 'object', properties: {
        cilId: { type: 'number' }, zdrojId: { type: 'number' },
      }, required: ['cilId','zdrojId'] },
      handler: async (a) => {
        const r = await client.post(`/lead/${a.cilId}/merge/${a.zdrojId}/`);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ Leady sloučeny.`;
      },
    },
    {
      name: 'konvertuj_lead',
      description: 'Konvertuje lead na firmu/kontakt/obchodní případ.',
      inputSchema: { type: 'object', properties: { id: { type: 'number' } }, required: ['id'] },
      handler: async (a) => {
        const r = await client.post(`/lead/${a.id}/convert/`, {});
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ Lead ID ${a.id} konvertován. ${JSON.stringify(r.data)}`;
      },
    },

    // ═══════════════════════════════════════════════════════════════
    // OBCHODNÍ PŘÍPADY (Deals)
    // ═══════════════════════════════════════════════════════════════
    {
      name: 'seznam_op',
      description: 'Vypíše seznam obchodních případů.',
      inputSchema: { type: 'object', properties: {
        fulltext: { type: 'string' }, firmaId: { type: 'number' },
        faze: { type: 'string' }, vlastnikId: { type: 'number' },
        limit: { type: 'number', default: 20 }, offset: { type: 'number', default: 0 },
      }},
      handler: async (a) => {
        const p = { limit: a.limit||20, offset: a.offset||0 };
        if (a.fulltext) p.fulltext = a.fulltext;
        if (a.firmaId) p['company[EQ]'] = a.firmaId;
        if (a.faze) p['businessCasePhase[EQ]'] = a.faze;
        if (a.vlastnikId) p['owner[EQ]'] = a.vlastnikId;
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
      description: 'Detail obchodního případu včetně položek a volitelných polí.',
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
          for (const [k,v] of Object.entries(o.customFields))
            if (v !== null && v !== '') out += `  - ${k}: ${JSON.stringify(v)}\n`;
        }
        return out;
      },
    },
    {
      name: 'vytvor_op',
      description: 'Vytvoří nový obchodní případ.',
      inputSchema: { type: 'object', properties: {
        nazev: { type: 'string' }, firmaId: { type: 'number' }, hodnota: { type: 'number' },
        pravdepodobnost: { type: 'number' }, platnostOd: { type: 'string' },
        popis: { type: 'string' }, fazeId: { type: 'number' }, vlastnikId: { type: 'number' },
      }, required: ['nazev','firmaId'] },
      handler: async (a) => {
        const body = R.body({ name: a.nazev, company: a.firmaId, totalAmount: a.hodnota,
          probability: a.pravdepodobnost, validFrom: a.platnostOd, description: a.popis,
          businessCasePhase: a.fazeId, owner: a.vlastnikId });
        const r = await client.put('/businessCase/', body);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ OP "${a.nazev}" vytvořen. ID: ${r.data?.id}`;
      },
    },
    {
      name: 'vytvor_op_s_polozkami',
      description: 'Vytvoří obchodní případ s produktovými položkami najednou.',
      inputSchema: { type: 'object', properties: {
        nazev: { type: 'string' }, firmaId: { type: 'number' }, fazeId: { type: 'number' },
        platnostOd: { type: 'string' }, vlastnikId: { type: 'number' },
        polozky: { type: 'array', items: { type: 'object', properties: {
          nazev: { type: 'string' }, mnozstvi: { type: 'number' }, cena: { type: 'number' },
          jednotka: { type: 'string' }, dph: { type: 'number' }, produktId: { type: 'number' },
        }, required: ['nazev'] }},
      }, required: ['nazev','firmaId'] },
      handler: async (a) => {
        const items = (a.polozky||[]).map(p => R.body({ name: p.nazev, count: p.mnozstvi, price: p.cena,
          unit: p.jednotka, taxRate: p.dph, product: R.ref(p.produktId) }));
        const body = R.body({ name: a.nazev, company: a.firmaId, businessCasePhase: a.fazeId,
          validFrom: a.platnostOd, owner: a.vlastnikId, items: items.length ? items : undefined });
        const r = await client.put('/businessCase/createWithItems', body);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ OP "${a.nazev}" s ${items.length} položkami vytvořen. ID: ${r.data?.id}`;
      },
    },
    {
      name: 'uprav_op',
      description: 'Upraví obchodní případ.',
      inputSchema: { type: 'object', properties: {
        id: { type: 'number' }, nazev: { type: 'string' }, hodnota: { type: 'number' },
        pravdepodobnost: { type: 'number' }, fazeId: { type: 'number' },
        popis: { type: 'string' }, vlastnikId: { type: 'number' }, volitelnaPolea: { type: 'object' },
      }, required: ['id'] },
      handler: async (a) => {
        const body = R.body({ name: a.nazev, totalAmount: a.hodnota, probability: a.pravdepodobnost,
          description: a.popis, businessCasePhase: R.ref(a.fazeId),
          owner: R.ref(a.vlastnikId), customFields: a.volitelnaPolea });
        const r = await client.post(`/businessCase/${a.id}/`, body);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ OP ID ${a.id} upraven.`;
      },
    },
    {
      name: 'smaz_op',
      description: 'Smaže obchodní případ.',
      inputSchema: { type: 'object', properties: { id: { type: 'number' } }, required: ['id'] },
      handler: async (a) => {
        const r = await client.del(`/businessCase/${a.id}/`);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ OP ID ${a.id} smazán.`;
      },
    },
    {
      name: 'zamkni_op',
      description: 'Zamkne obchodní případ.',
      inputSchema: { type: 'object', properties: { id: { type: 'number' } }, required: ['id'] },
      handler: async (a) => {
        const r = await client.post(`/businessCase/${a.id}/lock`);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ OP ID ${a.id} zamčen.`;
      },
    },
    {
      name: 'odemkni_op',
      description: 'Odemkne obchodní případ.',
      inputSchema: { type: 'object', properties: { id: { type: 'number' } }, required: ['id'] },
      handler: async (a) => {
        const r = await client.post(`/businessCase/${a.id}/unlock`);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ OP ID ${a.id} odemčen.`;
      },
    },
    {
      name: 'zneplatnit_op',
      description: 'Označí obchodní případ jako neplatný.',
      inputSchema: { type: 'object', properties: { id: { type: 'number' } }, required: ['id'] },
      handler: async (a) => {
        const r = await client.post(`/businessCase/${a.id}/invalid`);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ OP ID ${a.id} zneplatněn.`;
      },
    },
    {
      name: 'obnovit_op',
      description: 'Obnoví platnost obchodního případu.',
      inputSchema: { type: 'object', properties: { id: { type: 'number' } }, required: ['id'] },
      handler: async (a) => {
        const r = await client.post(`/businessCase/${a.id}/valid`);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ OP ID ${a.id} obnoven.`;
      },
    },
    {
      name: 'pridej_polozku_op',
      description: 'Přidá položku do obchodního případu.',
      inputSchema: { type: 'object', properties: {
        opId: { type: 'number' }, nazev: { type: 'string' }, mnozstvi: { type: 'number' },
        cena: { type: 'number' }, jednotka: { type: 'string' }, dph: { type: 'number' },
        sleva: { type: 'number' }, produktId: { type: 'number' }, popis: { type: 'string' },
      }, required: ['opId','nazev'] },
      handler: async (a) => {
        const body = R.body({ name: a.nazev, count: a.mnozstvi, price: a.cena, unit: a.jednotka,
          taxRate: a.dph, discountPercent: a.sleva, product: a.produktId, description: a.popis });
        const r = await client.put(`/businessCase/${a.opId}/item/`, body);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ Položka přidána do OP ${a.opId}.`;
      },
    },
    {
      name: 'uprav_polozku_op',
      description: 'Upraví položku obchodního případu.',
      inputSchema: { type: 'object', properties: {
        opId: { type: 'number' }, polozkaId: { type: 'number' }, nazev: { type: 'string' },
        mnozstvi: { type: 'number' }, cena: { type: 'number' },
      }, required: ['opId','polozkaId'] },
      handler: async (a) => {
        const body = R.body({ name: a.nazev, count: a.mnozstvi, price: a.cena });
        const r = await client.post(`/businessCase/${a.opId}/item/${a.polozkaId}/`, body);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ Položka ID ${a.polozkaId} upravena.`;
      },
    },
    {
      name: 'smaz_polozku_op',
      description: 'Smaže položku z obchodního případu.',
      inputSchema: { type: 'object', properties: {
        opId: { type: 'number' }, polozkaId: { type: 'number' },
      }, required: ['opId','polozkaId'] },
      handler: async (a) => {
        const r = await client.del(`/businessCase/${a.opId}/item/${a.polozkaId}/`);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ Položka ID ${a.polozkaId} smazána.`;
      },
    },
    {
      name: 'smaz_vsechny_polozky_op',
      description: 'Smaže všechny položky obchodního případu najednou.',
      inputSchema: { type: 'object', properties: { opId: { type: 'number' } }, required: ['opId'] },
      handler: async (a) => {
        const r = await client.post(`/businessCase/${a.opId}/item/bulkDelete`, {});
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ Všechny položky OP ${a.opId} smazány.`;
      },
    },
    {
      name: 'ucastnici_op',
      description: 'Zobrazí seznam účastníků obchodního případu.',
      inputSchema: { type: 'object', properties: { opId: { type: 'number' } }, required: ['opId'] },
      handler: async (a) => {
        const r = await client.get(`/businessCase/${a.opId}/participants/`);
        if (!r.success) return `Chyba: ${r.error}`;
        const d = Array.isArray(r.data) ? r.data : [];
        if (!d.length) return 'OP nemá žádné účastníky.';
        return `**Účastníci OP ${a.opId}:**\n` +
          d.map(u => `- ${u.person?.fullName||u.company?.name||'-'} (${u.category?.name||'-'}, ID: ${u.id})`).join('\n');
      },
    },
    {
      name: 'pridej_ucastnika_op',
      description: 'Přidá účastníka do obchodního případu.',
      inputSchema: { type: 'object', properties: {
        opId: { type: 'number' }, kontaktId: { type: 'number' }, kategorieId: { type: 'number' },
      }, required: ['opId','kontaktId'] },
      handler: async (a) => {
        const body = R.body({ person: R.ref(a.kontaktId), category: R.ref(a.kategorieId) });
        const r = await client.put(`/businessCase/${a.opId}/participants/`, body);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ Účastník přidán do OP ${a.opId}.`;
      },
    },
    {
      name: 'smaz_ucastnika_op',
      description: 'Odebere účastníka z obchodního případu.',
      inputSchema: { type: 'object', properties: {
        opId: { type: 'number' }, ucastnikId: { type: 'number' },
      }, required: ['opId','ucastnikId'] },
      handler: async (a) => {
        const r = await client.del(`/businessCase/${a.opId}/participants/${a.ucastnikId}`);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ Účastník ID ${a.ucastnikId} odebrán z OP ${a.opId}.`;
      },
    },
    {
      name: 'changelog_fazi_op',
      description: 'Historie změn fází obchodního případu.',
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
    {
      name: 'volitelna_pole_op',
      description: 'Načte nebo uloží volitelná pole obchodního případu.',
      inputSchema: { type: 'object', properties: { opId: { type: 'number' }, pole: { type: 'object' } }, required: ['opId'] },
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

    // ═══════════════════════════════════════════════════════════════
    // NABÍDKY (Offers)
    // ═══════════════════════════════════════════════════════════════
    {
      name: 'seznam_nabidek',
      description: 'Vypíše seznam nabídek.',
      inputSchema: { type: 'object', properties: {
        fulltext: { type: 'string' }, firmaId: { type: 'number' }, opId: { type: 'number' },
        limit: { type: 'number', default: 20 }, offset: { type: 'number', default: 0 },
      }},
      handler: async (a) => {
        const p = { limit: a.limit||20, offset: a.offset||0 };
        if (a.fulltext) p.fulltext = a.fulltext;
        if (a.firmaId) p['company[EQ]'] = a.firmaId;
        if (a.opId) p['businessCase[EQ]'] = a.opId;
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
      description: 'Detail nabídky včetně položek.',
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
            const qty = i.count ?? i.quantity ?? 0;
            const row = qty * (i.price||0);
            celkem += row;
            out += `  - **${i.name}** | ${qty} ${i.unit||'ks'} × ${i.price||0} Kč = ${row} Kč\n`;
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
        platnostOd: { type: 'string' }, platnostDo: { type: 'string' },
        popis: { type: 'string' }, vlastnikId: { type: 'number' },
      }, required: ['nazev','firmaId'] },
      handler: async (a) => {
        const body = R.body({ name: a.nazev, company: R.ref(a.firmaId), businessCase: R.ref(a.opId),
          validFrom: a.platnostOd, validTill: a.platnostDo, description: a.popis, owner: R.ref(a.vlastnikId) });
        const r = await client.put('/offer/', body);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ Nabídka "${a.nazev}" vytvořena. ID: ${r.data?.id}`;
      },
    },
    {
      name: 'vytvor_nabidku_s_polozkami',
      description: 'Vytvoří nabídku s položkami najednou.',
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
        const polozky = (a.polozky||[]).map(p => R.body({ name: p.nazev, count: p.mnozstvi, price: p.cena,
          unit: p.jednotka, taxRate: p.dph, discountPercent: p.sleva, product: R.ref(p.produktId), description: p.popis }));
        const body = R.body({ name: a.nazev, company: R.ref(a.firmaId), businessCase: R.ref(a.opId),
          validFrom: a.platnostOd, validTill: a.platnostDo, items: polozky.length ? polozky : undefined });
        const r = await client.put('/offer/createWithItems', body);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ Nabídka "${a.nazev}" s ${polozky.length} položkami vytvořena. ID: ${r.data?.id}`;
      },
    },
    {
      name: 'uprav_nabidku',
      description: 'Upraví nabídku.',
      inputSchema: { type: 'object', properties: {
        id: { type: 'number' }, nazev: { type: 'string' }, platnostOd: { type: 'string' },
        platnostDo: { type: 'string' }, popis: { type: 'string' }, volitelnaPolea: { type: 'object' },
      }, required: ['id'] },
      handler: async (a) => {
        const body = R.body({ name: a.nazev, validFrom: a.platnostOd, validTill: a.platnostDo,
          description: a.popis, customFields: a.volitelnaPolea });
        const r = await client.post(`/offer/${a.id}/`, body);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ Nabídka ID ${a.id} upravena.`;
      },
    },
    {
      name: 'smaz_nabidku',
      description: 'Smaže nabídku.',
      inputSchema: { type: 'object', properties: { id: { type: 'number' } }, required: ['id'] },
      handler: async (a) => {
        const r = await client.del(`/offer/${a.id}/`);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ Nabídka ID ${a.id} smazána.`;
      },
    },
    {
      name: 'zamkni_nabidku',
      description: 'Zamkne nabídku.',
      inputSchema: { type: 'object', properties: { id: { type: 'number' } }, required: ['id'] },
      handler: async (a) => {
        const r = await client.post(`/offer/${a.id}/lock`);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ Nabídka ID ${a.id} zamčena.`;
      },
    },
    {
      name: 'odemkni_nabidku',
      description: 'Odemkne nabídku.',
      inputSchema: { type: 'object', properties: { id: { type: 'number' } }, required: ['id'] },
      handler: async (a) => {
        const r = await client.post(`/offer/${a.id}/unlock`);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ Nabídka ID ${a.id} odemčena.`;
      },
    },
    {
      name: 'zneplatnit_nabidku',
      description: 'Označí nabídku jako neplatnou.',
      inputSchema: { type: 'object', properties: { id: { type: 'number' } }, required: ['id'] },
      handler: async (a) => {
        const r = await client.post(`/offer/${a.id}/invalid`);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ Nabídka ID ${a.id} zneplatněna.`;
      },
    },
    {
      name: 'obnovit_nabidku',
      description: 'Obnoví platnost nabídky.',
      inputSchema: { type: 'object', properties: { id: { type: 'number' } }, required: ['id'] },
      handler: async (a) => {
        const r = await client.post(`/offer/${a.id}/valid`);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ Nabídka ID ${a.id} obnovena.`;
      },
    },
    {
      name: 'pridej_polozku_nabidky',
      description: 'Přidá položku do nabídky.',
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
        return `✅ Položka přidána do nabídky ${a.nabidkaId}.`;
      },
    },
    {
      name: 'uprav_polozku_nabidky',
      description: 'Upraví položku nabídky.',
      inputSchema: { type: 'object', properties: {
        nabidkaId: { type: 'number' }, polozkaId: { type: 'number' },
        nazev: { type: 'string' }, mnozstvi: { type: 'number' }, cena: { type: 'number' },
      }, required: ['nabidkaId','polozkaId'] },
      handler: async (a) => {
        const body = R.body({ name: a.nazev, count: a.mnozstvi, price: a.cena });
        const r = await client.post(`/offer/${a.nabidkaId}/item/${a.polozkaId}/`, body);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ Položka ID ${a.polozkaId} upravena.`;
      },
    },
    {
      name: 'smaz_polozku_nabidky',
      description: 'Smaže položku z nabídky.',
      inputSchema: { type: 'object', properties: {
        nabidkaId: { type: 'number' }, polozkaId: { type: 'number' },
      }, required: ['nabidkaId','polozkaId'] },
      handler: async (a) => {
        const r = await client.del(`/offer/${a.nabidkaId}/item/${a.polozkaId}/`);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ Položka ID ${a.polozkaId} smazána z nabídky.`;
      },
    },
    {
      name: 'smaz_vsechny_polozky_nabidky',
      description: 'Smaže všechny položky nabídky najednou.',
      inputSchema: { type: 'object', properties: { nabidkaId: { type: 'number' } }, required: ['nabidkaId'] },
      handler: async (a) => {
        const r = await client.del(`/offer/${a.nabidkaId}/item/`);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ Všechny položky nabídky ${a.nabidkaId} smazány.`;
      },
    },
    {
      name: 'synchronizuj_nabidku_s_op',
      description: 'Synchronizuje nabídku s obchodním případem.',
      inputSchema: { type: 'object', properties: {
        nabidkaId: { type: 'number' }, opId: { type: 'number' },
      }, required: ['nabidkaId','opId'] },
      handler: async (a) => {
        const r = await client.post(`/offer/${a.nabidkaId}/sync`, { businessCase: R.ref(a.opId) });
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ Nabídka ${a.nabidkaId} synchronizována s OP ${a.opId}.`;
      },
    },
    {
      name: 'zrus_synchronizaci_nabidky',
      description: 'Zruší synchronizaci nabídky s obchodním případem.',
      inputSchema: { type: 'object', properties: { nabidkaId: { type: 'number' } }, required: ['nabidkaId'] },
      handler: async (a) => {
        const r = await client.del(`/offer/${a.nabidkaId}/sync`);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ Synchronizace nabídky ${a.nabidkaId} zrušena.`;
      },
    },

    // ═══════════════════════════════════════════════════════════════
    // OBJEDNÁVKY (Sales Orders)
    // ═══════════════════════════════════════════════════════════════
    {
      name: 'seznam_objednavek',
      description: 'Vypíše seznam objednávek.',
      inputSchema: { type: 'object', properties: {
        fulltext: { type: 'string' }, firmaId: { type: 'number' }, opId: { type: 'number' },
        limit: { type: 'number', default: 20 }, offset: { type: 'number', default: 0 },
      }},
      handler: async (a) => {
        const p = { limit: a.limit||20, offset: a.offset||0 };
        if (a.fulltext) p.fulltext = a.fulltext;
        if (a.firmaId) p['company[EQ]'] = a.firmaId;
        if (a.opId) p['businessCase[EQ]'] = a.opId;
        const r = await client.get('/salesOrder/', p);
        if (!r.success) return `Chyba: ${r.error}`;
        const d = Array.isArray(r.data) ? r.data : [];
        if (!d.length) return 'Žádné objednávky nenalezeny.';
        return `Nalezeno ${r.totalCount||d.length} objednávek:\n\n` +
          d.map(o => `**${o.name}** (ID: ${o.id})\n  Firma: ${o.company?.name||'-'} | Hodnota: ${o.totalAmount||0} Kč | Datum: ${o.validFrom||'-'}`).join('\n\n');
      },
    },
    {
      name: 'detail_objednavky',
      description: 'Detail objednávky včetně položek.',
      inputSchema: { type: 'object', properties: { id: { type: 'number' } }, required: ['id'] },
      handler: async (a) => {
        const r = await client.get(`/salesOrder/${a.id}/`);
        if (!r.success) return `Chyba: ${r.error}`;
        const o = r.data;
        let out = `## ${o.name} (ID: ${o.id})\n`;
        out += `- **Firma:** ${o.company?.name||'-'} | **OP:** ${o.businessCase?.name||'-'}\n`;
        out += `- **Hodnota:** ${o.totalAmount||0} Kč | **Datum:** ${o.validFrom||'-'}\n`;
        if (o.items?.length) {
          out += `\n**Položky (${o.items.length}):**\n`;
          o.items.forEach(i => {
            const qty = i.count ?? i.quantity ?? 0;
            out += `  - **${i.name}** | ${qty} ${i.unit||'ks'} × ${i.price||0} Kč\n`;
          });
        }
        return out;
      },
    },
    {
      name: 'vytvor_objednavku',
      description: 'Vytvoří novou objednávku.',
      inputSchema: { type: 'object', properties: {
        nazev: { type: 'string' }, firmaId: { type: 'number' }, opId: { type: 'number' },
        datumObjednavky: { type: 'string' }, datumDodani: { type: 'string' }, popis: { type: 'string' },
      }, required: ['nazev','firmaId'] },
      handler: async (a) => {
        const body = R.body({ name: a.nazev, company: R.ref(a.firmaId), businessCase: R.ref(a.opId),
          validFrom: a.datumObjednavky, requestDeliveryDate: a.datumDodani, description: a.popis });
        const r = await client.put('/salesOrder/', body);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ Objednávka "${a.nazev}" vytvořena. ID: ${r.data?.id}`;
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
    {
      name: 'uprav_objednavku',
      description: 'Upraví objednávku.',
      inputSchema: { type: 'object', properties: {
        id: { type: 'number' }, nazev: { type: 'string' }, popis: { type: 'string' },
        volitelnaPolea: { type: 'object' },
      }, required: ['id'] },
      handler: async (a) => {
        const body = R.body({ name: a.nazev, description: a.popis, customFields: a.volitelnaPolea });
        const r = await client.post(`/salesOrder/${a.id}/`, body);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ Objednávka ID ${a.id} upravena.`;
      },
    },
    {
      name: 'smaz_objednavku',
      description: 'Smaže objednávku.',
      inputSchema: { type: 'object', properties: { id: { type: 'number' } }, required: ['id'] },
      handler: async (a) => {
        const r = await client.del(`/salesOrder/${a.id}/`);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ Objednávka ID ${a.id} smazána.`;
      },
    },
    {
      name: 'zamkni_objednavku',
      description: 'Zamkne objednávku.',
      inputSchema: { type: 'object', properties: { id: { type: 'number' } }, required: ['id'] },
      handler: async (a) => {
        const r = await client.post(`/salesOrder/${a.id}/lock`);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ Objednávka ID ${a.id} zamčena.`;
      },
    },
    {
      name: 'odemkni_objednavku',
      description: 'Odemkne objednávku.',
      inputSchema: { type: 'object', properties: { id: { type: 'number' } }, required: ['id'] },
      handler: async (a) => {
        const r = await client.post(`/salesOrder/${a.id}/unlock`);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ Objednávka ID ${a.id} odemčena.`;
      },
    },
    {
      name: 'zneplatnit_objednavku',
      description: 'Označí objednávku jako neplatnou.',
      inputSchema: { type: 'object', properties: { id: { type: 'number' } }, required: ['id'] },
      handler: async (a) => {
        const r = await client.post(`/salesOrder/${a.id}/invalid`);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ Objednávka ID ${a.id} zneplatněna.`;
      },
    },
    {
      name: 'obnovit_objednavku',
      description: 'Obnoví platnost objednávky.',
      inputSchema: { type: 'object', properties: { id: { type: 'number' } }, required: ['id'] },
      handler: async (a) => {
        const r = await client.post(`/salesOrder/${a.id}/valid`);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ Objednávka ID ${a.id} obnovena.`;
      },
    },
    {
      name: 'pridej_polozku_objednavky',
      description: 'Přidá položku do objednávky.',
      inputSchema: { type: 'object', properties: {
        objednavkaId: { type: 'number' }, nazev: { type: 'string' }, mnozstvi: { type: 'number' },
        cena: { type: 'number' }, jednotka: { type: 'string' }, dph: { type: 'number' },
        sleva: { type: 'number' }, produktId: { type: 'number' },
      }, required: ['objednavkaId','nazev'] },
      handler: async (a) => {
        const body = R.body({ name: a.nazev, count: a.mnozstvi, price: a.cena, unit: a.jednotka,
          taxRate: a.dph, discountPercent: a.sleva, product: R.ref(a.produktId) });
        const r = await client.put(`/salesOrder/${a.objednavkaId}/item/`, body);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ Položka přidána do objednávky ${a.objednavkaId}.`;
      },
    },
    {
      name: 'uprav_polozku_objednavky',
      description: 'Upraví položku objednávky.',
      inputSchema: { type: 'object', properties: {
        objednavkaId: { type: 'number' }, polozkaId: { type: 'number' },
        nazev: { type: 'string' }, mnozstvi: { type: 'number' }, cena: { type: 'number' },
      }, required: ['objednavkaId','polozkaId'] },
      handler: async (a) => {
        const body = R.body({ name: a.nazev, count: a.mnozstvi, price: a.cena });
        const r = await client.post(`/salesOrder/${a.objednavkaId}/item/${a.polozkaId}/`, body);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ Položka ID ${a.polozkaId} upravena.`;
      },
    },
    {
      name: 'smaz_polozku_objednavky',
      description: 'Smaže položku z objednávky.',
      inputSchema: { type: 'object', properties: {
        objednavkaId: { type: 'number' }, polozkaId: { type: 'number' },
      }, required: ['objednavkaId','polozkaId'] },
      handler: async (a) => {
        const r = await client.del(`/salesOrder/${a.objednavkaId}/item/${a.polozkaId}/`);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ Položka ID ${a.polozkaId} smazána z objednávky.`;
      },
    },
    {
      name: 'smaz_vsechny_polozky_objednavky',
      description: 'Smaže všechny položky objednávky.',
      inputSchema: { type: 'object', properties: { objednavkaId: { type: 'number' } }, required: ['objednavkaId'] },
      handler: async (a) => {
        const r = await client.del(`/salesOrder/${a.objednavkaId}/item/`);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ Všechny položky objednávky ${a.objednavkaId} smazány.`;
      },
    },
    {
      name: 'synchronizuj_objednavku_s_op',
      description: 'Synchronizuje objednávku s obchodním případem.',
      inputSchema: { type: 'object', properties: {
        objednavkaId: { type: 'number' }, opId: { type: 'number' },
      }, required: ['objednavkaId','opId'] },
      handler: async (a) => {
        const r = await client.post(`/salesOrder/${a.objednavkaId}/sync`, { businessCase: R.ref(a.opId) });
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ Objednávka ${a.objednavkaId} synchronizována s OP ${a.opId}.`;
      },
    },

    // ═══════════════════════════════════════════════════════════════
    // PROJEKTY
    // ═══════════════════════════════════════════════════════════════
    {
      name: 'seznam_projektu',
      description: 'Vypíše seznam projektů.',
      inputSchema: { type: 'object', properties: {
        fulltext: { type: 'string' }, firmaId: { type: 'number' },
        limit: { type: 'number', default: 20 }, offset: { type: 'number', default: 0 },
      }},
      handler: async (a) => {
        const p = { limit: a.limit||20, offset: a.offset||0 };
        if (a.fulltext) p.fulltext = a.fulltext;
        if (a.firmaId) p['company[EQ]'] = a.firmaId;
        const r = await client.get('/project/', p);
        if (!r.success) return `Chyba: ${r.error}`;
        const d = Array.isArray(r.data) ? r.data : [];
        if (!d.length) return 'Žádné projekty nenalezeny.';
        return `Nalezeno ${r.totalCount||d.length} projektů:\n\n` +
          d.map(p => `**${p.name}** (ID: ${p.id})\n  Firma: ${p.company?.name||'-'} | Stav: ${p.projectStatus?.name||'-'}`).join('\n\n');
      },
    },
    {
      name: 'detail_projektu',
      description: 'Detail projektu.',
      inputSchema: { type: 'object', properties: { id: { type: 'number' } }, required: ['id'] },
      handler: async (a) => {
        const r = await client.get(`/project/${a.id}/`);
        if (!r.success) return `Chyba: ${r.error}`;
        const p = r.data;
        let out = `## ${p.name} (ID: ${p.id})\n`;
        out += `- **Firma:** ${p.company?.name||'-'} | **Stav:** ${p.projectStatus?.name||'-'}\n`;
        out += `- **Vlastník:** ${p.owner?.fullName||'-'}\n`;
        if (p.description) out += `- **Popis:** ${p.description}\n`;
        if (p.customFields && Object.keys(p.customFields).length) {
          out += `\n**Volitelná pole:**\n`;
          for (const [k,v] of Object.entries(p.customFields))
            if (v !== null && v !== '') out += `  - ${k}: ${JSON.stringify(v)}\n`;
        }
        return out;
      },
    },
    {
      name: 'vytvor_projekt',
      description: 'Vytvoří nový projekt.',
      inputSchema: { type: 'object', properties: {
        nazev: { type: 'string' }, firmaId: { type: 'number' },
        popis: { type: 'string' }, vlastnikId: { type: 'number' },
      }, required: ['nazev'] },
      handler: async (a) => {
        const body = R.body({ name: a.nazev, company: R.ref(a.firmaId),
          description: a.popis, owner: R.ref(a.vlastnikId) });
        const r = await client.put('/project/', body);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ Projekt "${a.nazev}" vytvořen. ID: ${r.data?.id}`;
      },
    },
    {
      name: 'uprav_projekt',
      description: 'Upraví projekt.',
      inputSchema: { type: 'object', properties: {
        id: { type: 'number' }, nazev: { type: 'string' }, popis: { type: 'string' },
        vlastnikId: { type: 'number' }, volitelnaPolea: { type: 'object' },
      }, required: ['id'] },
      handler: async (a) => {
        const body = R.body({ name: a.nazev, description: a.popis,
          owner: R.ref(a.vlastnikId), customFields: a.volitelnaPolea });
        const r = await client.post(`/project/${a.id}/`, body);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ Projekt ID ${a.id} upraven.`;
      },
    },
    {
      name: 'smaz_projekt',
      description: 'Smaže projekt.',
      inputSchema: { type: 'object', properties: { id: { type: 'number' } }, required: ['id'] },
      handler: async (a) => {
        const r = await client.del(`/project/${a.id}/`);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ Projekt ID ${a.id} smazán.`;
      },
    },
    {
      name: 'zamkni_projekt',
      description: 'Zamkne projekt.',
      inputSchema: { type: 'object', properties: { id: { type: 'number' } }, required: ['id'] },
      handler: async (a) => {
        const r = await client.post(`/project/${a.id}/lock`);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ Projekt ID ${a.id} zamčen.`;
      },
    },
    {
      name: 'odemkni_projekt',
      description: 'Odemkne projekt.',
      inputSchema: { type: 'object', properties: { id: { type: 'number' } }, required: ['id'] },
      handler: async (a) => {
        const r = await client.post(`/project/${a.id}/unlock`);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ Projekt ID ${a.id} odemčen.`;
      },
    },
    {
      name: 'zneplatnit_projekt',
      description: 'Označí projekt jako neplatný.',
      inputSchema: { type: 'object', properties: { id: { type: 'number' } }, required: ['id'] },
      handler: async (a) => {
        const r = await client.post(`/project/${a.id}/invalid`);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ Projekt ID ${a.id} zneplatněn.`;
      },
    },
    {
      name: 'obnovit_projekt',
      description: 'Obnoví platnost projektu.',
      inputSchema: { type: 'object', properties: { id: { type: 'number' } }, required: ['id'] },
      handler: async (a) => {
        const r = await client.post(`/project/${a.id}/valid`);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ Projekt ID ${a.id} obnoven.`;
      },
    },
    {
      name: 'ucastnici_projektu',
      description: 'Zobrazí účastníky projektu.',
      inputSchema: { type: 'object', properties: { projektId: { type: 'number' } }, required: ['projektId'] },
      handler: async (a) => {
        const r = await client.get(`/project/${a.projektId}/participants/`);
        if (!r.success) return `Chyba: ${r.error}`;
        const d = Array.isArray(r.data) ? r.data : [];
        if (!d.length) return 'Projekt nemá žádné účastníky.';
        return `**Účastníci projektu ${a.projektId}:**\n` +
          d.map(u => `- ${u.person?.fullName||u.company?.name||'-'} (${u.category?.name||'-'})`).join('\n');
      },
    },
    {
      name: 'pridej_ucastnika_projektu',
      description: 'Přidá účastníka do projektu.',
      inputSchema: { type: 'object', properties: {
        projektId: { type: 'number' }, kontaktId: { type: 'number' }, kategorieId: { type: 'number' },
      }, required: ['projektId','kontaktId'] },
      handler: async (a) => {
        const body = R.body({ person: R.ref(a.kontaktId), category: R.ref(a.kategorieId) });
        const r = await client.put(`/project/${a.projektId}/participants/`, body);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ Účastník přidán do projektu ${a.projektId}.`;
      },
    },
    {
      name: 'smaz_ucastnika_projektu',
      description: 'Odebere účastníka z projektu.',
      inputSchema: { type: 'object', properties: {
        projektId: { type: 'number' }, ucastnikId: { type: 'number' },
      }, required: ['projektId','ucastnikId'] },
      handler: async (a) => {
        const r = await client.del(`/project/${a.projektId}/participants/${a.ucastnikId}`);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ Účastník ID ${a.ucastnikId} odebrán z projektu ${a.projektId}.`;
      },
    },

    // ═══════════════════════════════════════════════════════════════
    // PRODUKTY
    // ═══════════════════════════════════════════════════════════════
    {
      name: 'seznam_produktu',
      description: 'Vypíše seznam produktů.',
      inputSchema: { type: 'object', properties: {
        fulltext: { type: 'string' }, kategorieId: { type: 'number' }, aktivni: { type: 'boolean' },
        limit: { type: 'number', default: 20 }, offset: { type: 'number', default: 0 },
      }},
      handler: async (a) => {
        const p = { limit: a.limit||20, offset: a.offset||0 };
        if (a.fulltext) p.fulltext = a.fulltext;
        if (a.kategorieId) p['productCategory[EQ]'] = a.kategorieId;
        if (a.aktivni !== undefined) p.active = a.aktivni;
        const r = await client.get('/product/', p);
        if (!r.success) return `Chyba: ${r.error}`;
        const d = Array.isArray(r.data) ? r.data : [];
        if (!d.length) return 'Žádné produkty nenalezeny.';
        return `Nalezeno ${r.totalCount||d.length} produktů:\n\n` +
          d.map(p => `**${p.name}** (Kód: ${p.code||'-'}, ID: ${p.id})\n  Kat: ${p.category?.name||'-'} | Cena: ${p.price||0} Kč | DPH: ${p.taxRate||0}%`).join('\n\n');
      },
    },
    {
      name: 'detail_produktu',
      description: 'Detail produktu.',
      inputSchema: { type: 'object', properties: { id: { type: 'number' } }, required: ['id'] },
      handler: async (a) => {
        const r = await client.get(`/product/${a.id}/`);
        if (!r.success) return `Chyba: ${r.error}`;
        const p = r.data;
        return `## ${p.name} (ID: ${p.id})\n- **Kód:** ${p.code||'-'} | **Kategorie:** ${p.category?.name||'-'}\n- **Cena:** ${p.price||0} Kč | **Náklad:** ${p.cost||0} Kč | **DPH:** ${p.taxRate||0}%\n- **Jednotka:** ${p.unit||'-'} | **Aktivní:** ${p.active ? 'Ano' : 'Ne'}`;
      },
    },
    {
      name: 'vytvor_produkt',
      description: 'Vytvoří nový produkt.',
      inputSchema: { type: 'object', properties: {
        kod: { type: 'string' }, nazev: { type: 'string' }, kategorieId: { type: 'number' },
        cena: { type: 'number' }, naklad: { type: 'number' }, dph: { type: 'number' },
        jednotka: { type: 'string' }, popis: { type: 'string' },
      }, required: ['kod','nazev'] },
      handler: async (a) => {
        const body = R.body({ code: a.kod, name: a.nazev, price: a.cena, cost: a.naklad,
          taxRate: a.dph, unit: a.jednotka, description: a.popis, category: R.ref(a.kategorieId) });
        const r = await client.put('/product/', body);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ Produkt "${a.nazev}" vytvořen. ID: ${r.data?.id}`;
      },
    },
    {
      name: 'uprav_produkt',
      description: 'Upraví produkt.',
      inputSchema: { type: 'object', properties: {
        id: { type: 'number' }, nazev: { type: 'string' }, kod: { type: 'string' },
        cena: { type: 'number' }, naklad: { type: 'number' }, dph: { type: 'number' },
        jednotka: { type: 'string' }, popis: { type: 'string' }, kategorieId: { type: 'number' },
      }, required: ['id'] },
      handler: async (a) => {
        const body = R.body({ name: a.nazev, code: a.kod, price: a.cena, cost: a.naklad,
          taxRate: a.dph, unit: a.jednotka, description: a.popis, category: R.ref(a.kategorieId) });
        const r = await client.post(`/product/${a.id}/`, body);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ Produkt ID ${a.id} upraven.`;
      },
    },
    {
      name: 'smaz_produkt',
      description: 'Smaže produkt.',
      inputSchema: { type: 'object', properties: { id: { type: 'number' } }, required: ['id'] },
      handler: async (a) => {
        const r = await client.del(`/product/${a.id}/`);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ Produkt ID ${a.id} smazán.`;
      },
    },
    {
      name: 'zneplatnit_produkt',
      description: 'Označí produkt jako neplatný (deaktivuje).',
      inputSchema: { type: 'object', properties: { id: { type: 'number' } }, required: ['id'] },
      handler: async (a) => {
        const r = await client.post(`/product/${a.id}/invalid`);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ Produkt ID ${a.id} deaktivován.`;
      },
    },
    {
      name: 'obnovit_produkt',
      description: 'Aktivuje produkt.',
      inputSchema: { type: 'object', properties: { id: { type: 'number' } }, required: ['id'] },
      handler: async (a) => {
        const r = await client.post(`/product/${a.id}/valid`);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ Produkt ID ${a.id} aktivován.`;
      },
    },

    // ═══════════════════════════════════════════════════════════════
    // AKTIVITY — ÚKOLY (Tasks)
    // ═══════════════════════════════════════════════════════════════
    {
      name: 'seznam_ukolu',
      description: 'Vypíše seznam úkolů.',
      inputSchema: { type: 'object', properties: {
        fulltext: { type: 'string' }, firmaId: { type: 'number' }, vlastnikId: { type: 'number' },
        limit: { type: 'number', default: 20 }, offset: { type: 'number', default: 0 },
      }},
      handler: async (a) => {
        const p = { limit: a.limit||20, offset: a.offset||0 };
        if (a.fulltext) p.fulltext = a.fulltext;
        if (a.firmaId) p['company[EQ]'] = a.firmaId;
        if (a.vlastnikId) p['owner[EQ]'] = a.vlastnikId;
        const r = await client.get('/task/', p);
        if (!r.success) return `Chyba: ${r.error}`;
        const d = Array.isArray(r.data) ? r.data : [];
        if (!d.length) return 'Žádné úkoly nenalezeny.';
        return `Nalezeno ${r.totalCount||d.length} úkolů:\n\n` +
          d.map(u => `**${u.title}** (ID: ${u.id})\n  Firma: ${u.company?.name||'-'} | Termín: ${u.deadline||'-'} | Priorita: ${u.priority||'-'}`).join('\n\n');
      },
    },
    {
      name: 'detail_ukolu',
      description: 'Detail úkolu.',
      inputSchema: { type: 'object', properties: { id: { type: 'number' } }, required: ['id'] },
      handler: async (a) => {
        const r = await client.get(`/task/${a.id}/`);
        if (!r.success) return `Chyba: ${r.error}`;
        const u = r.data;
        return `## ${u.title} (ID: ${u.id})\n- **Firma:** ${u.company?.name||'-'} | **Kontakt:** ${u.person?.fullName||'-'}\n- **Termín:** ${u.deadline||'-'} | **Priorita:** ${u.priority||'-'}\n- **Vlastník:** ${u.owner?.fullName||'-'}\n- **Popis:** ${u.description||'-'}`;
      },
    },
    {
      name: 'vytvor_ukol',
      description: 'Vytvoří nový úkol.',
      inputSchema: { type: 'object', properties: {
        nazev: { type: 'string' }, termin: { type: 'string' },
        priorita: { type: 'string', enum: ['HIGH','NORMAL','LOW'] },
        firmaId: { type: 'number' }, kontaktId: { type: 'number' }, opId: { type: 'number' },
        popis: { type: 'string' }, vlastnikId: { type: 'number' },
      }, required: ['nazev'] },
      handler: async (a) => {
        const body = R.body({ title: a.nazev, deadline: a.termin, priority: a.priorita||'NORMAL',
          company: R.ref(a.firmaId), person: R.ref(a.kontaktId),
          businessCase: R.ref(a.opId), description: a.popis, owner: R.ref(a.vlastnikId) });
        const r = await client.put('/task/', body);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ Úkol "${a.nazev}" vytvořen. ID: ${r.data?.id}`;
      },
    },
    {
      name: 'uprav_ukol',
      description: 'Upraví úkol.',
      inputSchema: { type: 'object', properties: {
        id: { type: 'number' }, nazev: { type: 'string' }, termin: { type: 'string' },
        priorita: { type: 'string', enum: ['HIGH','NORMAL','LOW'] },
        popis: { type: 'string' }, vlastnikId: { type: 'number' },
      }, required: ['id'] },
      handler: async (a) => {
        const body = R.body({ title: a.nazev, deadline: a.termin, priority: a.priorita,
          description: a.popis, owner: R.ref(a.vlastnikId) });
        const r = await client.post(`/task/${a.id}/`, body);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ Úkol ID ${a.id} upraven.`;
      },
    },
    {
      name: 'smaz_ukol',
      description: 'Smaže úkol.',
      inputSchema: { type: 'object', properties: { id: { type: 'number' } }, required: ['id'] },
      handler: async (a) => {
        const r = await client.del(`/task/${a.id}/`);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ Úkol ID ${a.id} smazán.`;
      },
    },

    // ═══════════════════════════════════════════════════════════════
    // AKTIVITY — SCHŮZKY (Meetings)
    // ═══════════════════════════════════════════════════════════════
    {
      name: 'seznam_schuzek',
      description: 'Vypíše seznam schůzek.',
      inputSchema: { type: 'object', properties: {
        fulltext: { type: 'string' }, firmaId: { type: 'number' }, vlastnikId: { type: 'number' },
        limit: { type: 'number', default: 20 }, offset: { type: 'number', default: 0 },
      }},
      handler: async (a) => {
        const p = { limit: a.limit||20, offset: a.offset||0 };
        if (a.fulltext) p.fulltext = a.fulltext;
        if (a.firmaId) p['company[EQ]'] = a.firmaId;
        if (a.vlastnikId) p['owner[EQ]'] = a.vlastnikId;
        const r = await client.get('/meeting/', p);
        if (!r.success) return `Chyba: ${r.error}`;
        const d = Array.isArray(r.data) ? r.data : [];
        if (!d.length) return 'Žádné schůzky nenalezeny.';
        return `Nalezeno ${r.totalCount||d.length} schůzek:\n\n` +
          d.map(s => `**${s.title}** (ID: ${s.id})\n  Firma: ${s.company?.name||'-'} | Od: ${s.scheduledFrom||'-'} | Do: ${s.scheduledTill||'-'}`).join('\n\n');
      },
    },
    {
      name: 'detail_schuzky',
      description: 'Detail schůzky.',
      inputSchema: { type: 'object', properties: { id: { type: 'number' } }, required: ['id'] },
      handler: async (a) => {
        const r = await client.get(`/meeting/${a.id}/`);
        if (!r.success) return `Chyba: ${r.error}`;
        const s = r.data;
        return `## ${s.title} (ID: ${s.id})\n- **Firma:** ${s.company?.name||'-'}\n- **Od:** ${s.scheduledFrom||'-'} | **Do:** ${s.scheduledTill||'-'}\n- **Vlastník:** ${s.owner?.fullName||'-'}\n- **Popis:** ${s.description||'-'}`;
      },
    },
    {
      name: 'vytvor_schuzku',
      description: 'Vytvoří novou schůzku.',
      inputSchema: { type: 'object', properties: {
        nazev: { type: 'string' }, od: { type: 'string' }, do: { type: 'string' },
        firmaId: { type: 'number' }, kontaktId: { type: 'number' }, opId: { type: 'number' },
        popis: { type: 'string' }, vlastnikId: { type: 'number' },
      }, required: ['nazev'] },
      handler: async (a) => {
        const body = R.body({ title: a.nazev, scheduledFrom: a.od, scheduledTill: a.do, priority: 'NORMAL',
          company: R.ref(a.firmaId), person: R.ref(a.kontaktId),
          businessCase: R.ref(a.opId), description: a.popis, owner: R.ref(a.vlastnikId) });
        const r = await client.put('/meeting/', body);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ Schůzka "${a.nazev}" vytvořena. ID: ${r.data?.id}`;
      },
    },
    {
      name: 'uprav_schuzku',
      description: 'Upraví schůzku.',
      inputSchema: { type: 'object', properties: {
        id: { type: 'number' }, nazev: { type: 'string' }, od: { type: 'string' }, do: { type: 'string' },
        popis: { type: 'string' },
      }, required: ['id'] },
      handler: async (a) => {
        const body = R.body({ title: a.nazev, scheduledFrom: a.od, scheduledTill: a.do, description: a.popis });
        const r = await client.post(`/meeting/${a.id}/`, body);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ Schůzka ID ${a.id} upravena.`;
      },
    },
    {
      name: 'smaz_schuzku',
      description: 'Smaže schůzku.',
      inputSchema: { type: 'object', properties: { id: { type: 'number' } }, required: ['id'] },
      handler: async (a) => {
        const r = await client.del(`/meeting/${a.id}/`);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ Schůzka ID ${a.id} smazána.`;
      },
    },

    // ═══════════════════════════════════════════════════════════════
    // AKTIVITY — TELEFONÁTY (Phone Calls)
    // ═══════════════════════════════════════════════════════════════
    {
      name: 'seznam_telefonatu',
      description: 'Vypíše seznam telefonátů.',
      inputSchema: { type: 'object', properties: {
        fulltext: { type: 'string' }, firmaId: { type: 'number' },
        limit: { type: 'number', default: 20 }, offset: { type: 'number', default: 0 },
      }},
      handler: async (a) => {
        const p = { limit: a.limit||20, offset: a.offset||0 };
        if (a.fulltext) p.fulltext = a.fulltext;
        if (a.firmaId) p['company[EQ]'] = a.firmaId;
        const r = await client.get('/phonecall/', p);
        if (!r.success) return `Chyba: ${r.error}`;
        const d = Array.isArray(r.data) ? r.data : [];
        if (!d.length) return 'Žádné telefonáty nenalezeny.';
        return d.map(t => `**${t.title}** (ID: ${t.id})\n  Firma: ${t.company?.name||'-'} | Datum: ${t.scheduledFrom||'-'}`).join('\n\n');
      },
    },
    {
      name: 'detail_telefonatu',
      description: 'Detail telefonátu.',
      inputSchema: { type: 'object', properties: { id: { type: 'number' } }, required: ['id'] },
      handler: async (a) => {
        const r = await client.get(`/phoneCall/${a.id}/`);
        if (!r.success) return `Chyba: ${r.error}`;
        const t = r.data;
        return `## ${t.title} (ID: ${t.id})\n- **Firma:** ${t.company?.name||'-'} | **Kontakt:** ${t.person?.fullName||'-'}\n- **Datum:** ${t.scheduledFrom||'-'}\n- **Popis:** ${t.description||'-'}\n- **Řešení:** ${t.solution||'-'}`;
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
    {
      name: 'uprav_telefonat',
      description: 'Upraví telefonát.',
      inputSchema: { type: 'object', properties: {
        id: { type: 'number' }, nazev: { type: 'string' },
        popis: { type: 'string' }, reseni: { type: 'string' },
      }, required: ['id'] },
      handler: async (a) => {
        const body = R.body({ title: a.nazev, description: a.popis, solution: a.reseni });
        const r = await client.post(`/phoneCall/${a.id}/`, body);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ Telefonát ID ${a.id} upraven.`;
      },
    },
    {
      name: 'smaz_telefonat',
      description: 'Smaže telefonát.',
      inputSchema: { type: 'object', properties: { id: { type: 'number' } }, required: ['id'] },
      handler: async (a) => {
        const r = await client.del(`/phoneCall/${a.id}/`);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ Telefonát ID ${a.id} smazán.`;
      },
    },

    // ═══════════════════════════════════════════════════════════════
    // AKTIVITY — EMAILY
    // ═══════════════════════════════════════════════════════════════
    {
      name: 'seznam_emailu',
      description: 'Vypíše seznam emailů zaznamenaných v CRM.',
      inputSchema: { type: 'object', properties: {
        fulltext: { type: 'string' }, firmaId: { type: 'number' },
        limit: { type: 'number', default: 20 }, offset: { type: 'number', default: 0 },
      }},
      handler: async (a) => {
        const p = { limit: a.limit||20, offset: a.offset||0 };
        if (a.fulltext) p.fulltext = a.fulltext;
        if (a.firmaId) p['company[EQ]'] = a.firmaId;
        const r = await client.get('/email/', p);
        if (!r.success) return `Chyba: ${r.error}`;
        const d = Array.isArray(r.data) ? r.data : [];
        if (!d.length) return 'Žádné emaily nenalezeny.';
        return d.map(e => `**${e.title}** (ID: ${e.id})\n  Firma: ${e.company?.name||'-'} | Datum: ${e.scheduledFrom||'-'}`).join('\n\n');
      },
    },
    {
      name: 'detail_emailu',
      description: 'Detail emailu.',
      inputSchema: { type: 'object', properties: { id: { type: 'number' } }, required: ['id'] },
      handler: async (a) => {
        const r = await client.get(`/email/${a.id}/`);
        if (!r.success) return `Chyba: ${r.error}`;
        const e = r.data;
        return `## ${e.title} (ID: ${e.id})\n- **Firma:** ${e.company?.name||'-'}\n- **Datum:** ${e.scheduledFrom||'-'}\n- **Popis:** ${e.description||'-'}`;
      },
    },
    {
      name: 'vytvor_email',
      description: 'Zaznamená email do CRM.',
      inputSchema: { type: 'object', properties: {
        nazev: { type: 'string' }, od: { type: 'string' },
        firmaId: { type: 'number' }, kontaktId: { type: 'number' }, opId: { type: 'number' },
        popis: { type: 'string' }, vlastnikId: { type: 'number' },
      }, required: ['nazev'] },
      handler: async (a) => {
        const body = R.body({ title: a.nazev, scheduledFrom: a.od, priority: 'NORMAL',
          company: R.ref(a.firmaId), person: R.ref(a.kontaktId),
          businessCase: R.ref(a.opId), description: a.popis, owner: R.ref(a.vlastnikId) });
        const r = await client.put('/email/', body);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ Email "${a.nazev}" zaznamenán. ID: ${r.data?.id}`;
      },
    },
    {
      name: 'smaz_email',
      description: 'Smaže email z CRM.',
      inputSchema: { type: 'object', properties: { id: { type: 'number' } }, required: ['id'] },
      handler: async (a) => {
        const r = await client.del(`/email/${a.id}/`);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ Email ID ${a.id} smazán.`;
      },
    },

    // ═══════════════════════════════════════════════════════════════
    // AKTIVITY — UDÁLOSTI (Events)
    // ═══════════════════════════════════════════════════════════════
    {
      name: 'seznam_udalosti',
      description: 'Vypíše seznam událostí.',
      inputSchema: { type: 'object', properties: {
        fulltext: { type: 'string' }, firmaId: { type: 'number' },
        limit: { type: 'number', default: 20 }, offset: { type: 'number', default: 0 },
      }},
      handler: async (a) => {
        const p = { limit: a.limit||20, offset: a.offset||0 };
        if (a.fulltext) p.fulltext = a.fulltext;
        if (a.firmaId) p['company[EQ]'] = a.firmaId;
        const r = await client.get('/event/', p);
        if (!r.success) return `Chyba: ${r.error}`;
        const d = Array.isArray(r.data) ? r.data : [];
        if (!d.length) return 'Žádné události nenalezeny.';
        return d.map(e => `**${e.title}** (ID: ${e.id})\n  Od: ${e.scheduledFrom||'-'} | Do: ${e.scheduledTill||'-'}`).join('\n\n');
      },
    },
    {
      name: 'vytvor_udalost',
      description: 'Vytvoří novou událost.',
      inputSchema: { type: 'object', properties: {
        nazev: { type: 'string' }, od: { type: 'string' }, do: { type: 'string' },
        firmaId: { type: 'number' }, opId: { type: 'number' },
        popis: { type: 'string' }, vlastnikId: { type: 'number' },
      }, required: ['nazev'] },
      handler: async (a) => {
        const body = R.body({ title: a.nazev, scheduledFrom: a.od, scheduledTill: a.do,
          company: R.ref(a.firmaId), businessCase: R.ref(a.opId),
          description: a.popis, owner: R.ref(a.vlastnikId) });
        const r = await client.put('/event/', body);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ Událost "${a.nazev}" vytvořena. ID: ${r.data?.id}`;
      },
    },
    {
      name: 'smaz_udalost',
      description: 'Smaže událost.',
      inputSchema: { type: 'object', properties: { id: { type: 'number' } }, required: ['id'] },
      handler: async (a) => {
        const r = await client.del(`/event/${a.id}/`);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ Událost ID ${a.id} smazána.`;
      },
    },

    // ═══════════════════════════════════════════════════════════════
    // AKTIVITY — DOPISY (Letters)
    // ═══════════════════════════════════════════════════════════════
    {
      name: 'seznam_dopisu',
      description: 'Vypíše seznam dopisů zaznamenaných v CRM.',
      inputSchema: { type: 'object', properties: {
        fulltext: { type: 'string' }, firmaId: { type: 'number' },
        limit: { type: 'number', default: 20 }, offset: { type: 'number', default: 0 },
      }},
      handler: async (a) => {
        const p = { limit: a.limit||20, offset: a.offset||0 };
        if (a.fulltext) p.fulltext = a.fulltext;
        if (a.firmaId) p['company[EQ]'] = a.firmaId;
        const r = await client.get('/letter/', p);
        if (!r.success) return `Chyba: ${r.error}`;
        const d = Array.isArray(r.data) ? r.data : [];
        if (!d.length) return 'Žádné dopisy nenalezeny.';
        return d.map(l => `**${l.title}** (ID: ${l.id})\n  Datum: ${l.scheduledFrom||'-'}`).join('\n\n');
      },
    },
    {
      name: 'vytvor_dopis',
      description: 'Zaznamená dopis do CRM.',
      inputSchema: { type: 'object', properties: {
        nazev: { type: 'string' }, od: { type: 'string' },
        firmaId: { type: 'number' }, kontaktId: { type: 'number' },
        popis: { type: 'string' }, vlastnikId: { type: 'number' },
      }, required: ['nazev'] },
      handler: async (a) => {
        const body = R.body({ title: a.nazev, scheduledFrom: a.od,
          company: R.ref(a.firmaId), person: R.ref(a.kontaktId),
          description: a.popis, owner: R.ref(a.vlastnikId) });
        const r = await client.put('/letter/', body);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ Dopis "${a.nazev}" zaznamenán. ID: ${r.data?.id}`;
      },
    },
    {
      name: 'smaz_dopis',
      description: 'Smaže dopis.',
      inputSchema: { type: 'object', properties: { id: { type: 'number' } }, required: ['id'] },
      handler: async (a) => {
        const r = await client.del(`/letter/${a.id}/`);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ Dopis ID ${a.id} smazán.`;
      },
    },

    // ═══════════════════════════════════════════════════════════════
    // SOUHRNNÝ SEZNAM AKTIVIT
    // ═══════════════════════════════════════════════════════════════
    {
      name: 'seznam_aktivit',
      description: 'Souhrnný seznam všech aktivit (úkoly, schůzky, telefonáty, emaily, události, dopisy).',
      inputSchema: { type: 'object', properties: {
        firmaId: { type: 'number' }, opId: { type: 'number' },
        limit: { type: 'number', default: 20 }, offset: { type: 'number', default: 0 },
      }},
      handler: async (a) => {
        const p = { limit: a.limit||20, offset: a.offset||0 };
        if (a.firmaId) p['company[EQ]'] = a.firmaId;
        if (a.opId) p['businessCase[EQ]'] = a.opId;
        const r = await client.get('/activity/', p);
        if (!r.success) return `Chyba: ${r.error}`;
        const d = Array.isArray(r.data) ? r.data : [];
        if (!d.length) return 'Žádné aktivity nenalezeny.';
        return d.map(a => `**${a.title}** [${a.type||'-'}] (ID: ${a.id})\n  Firma: ${a.company?.name||'-'} | Datum: ${a.scheduledFrom||a.deadline||'-'}`).join('\n\n');
      },
    },

    // ═══════════════════════════════════════════════════════════════
    // CENÍKY (Price Lists)
    // ═══════════════════════════════════════════════════════════════
    {
      name: 'seznam_ceniku',
      description: 'Vypíše seznam ceníků.',
      inputSchema: { type: 'object', properties: {
        limit: { type: 'number', default: 20 }, offset: { type: 'number', default: 0 },
      }},
      handler: async (a) => {
        const r = await client.get('/priceList/', { limit: a.limit||20, offset: a.offset||0 });
        if (!r.success) return `Chyba: ${r.error}`;
        const d = Array.isArray(r.data) ? r.data : [];
        if (!d.length) return 'Žádné ceníky nenalezeny.';
        return `Nalezeno ${r.totalCount||d.length} ceníků:\n\n` +
          d.map(c => `**${c.name}** (ID: ${c.id}) | Měna: ${c.currency?.name||'-'}`).join('\n\n');
      },
    },
    {
      name: 'detail_ceniku',
      description: 'Detail ceníku.',
      inputSchema: { type: 'object', properties: { id: { type: 'number' } }, required: ['id'] },
      handler: async (a) => {
        const r = await client.get(`/priceList/${a.id}/`);
        if (!r.success) return `Chyba: ${r.error}`;
        const c = r.data;
        return `## ${c.name} (ID: ${c.id})\n- Měna: ${c.currency?.name||'-'}\n- Kategorie: ${c.category?.name||'-'}`;
      },
    },
    {
      name: 'vytvor_cenik',
      description: 'Vytvoří nový ceník.',
      inputSchema: { type: 'object', properties: {
        nazev: { type: 'string' }, menaId: { type: 'number' }, kategorieId: { type: 'number' },
      }, required: ['nazev'] },
      handler: async (a) => {
        const body = R.body({ name: a.nazev, currency: R.ref(a.menaId), category: R.ref(a.kategorieId) });
        const r = await client.put('/priceList/', body);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ Ceník "${a.nazev}" vytvořen. ID: ${r.data?.id}`;
      },
    },
    {
      name: 'smaz_cenik',
      description: 'Smaže ceník.',
      inputSchema: { type: 'object', properties: { id: { type: 'number' } }, required: ['id'] },
      handler: async (a) => {
        const r = await client.del(`/priceList/${a.id}/`);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ Ceník ID ${a.id} smazán.`;
      },
    },
    {
      name: 'zamkni_cenik',
      description: 'Zamkne ceník.',
      inputSchema: { type: 'object', properties: { id: { type: 'number' } }, required: ['id'] },
      handler: async (a) => {
        const r = await client.post(`/priceList/${a.id}/lock`);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ Ceník ID ${a.id} zamčen.`;
      },
    },
    {
      name: 'odemkni_cenik',
      description: 'Odemkne ceník.',
      inputSchema: { type: 'object', properties: { id: { type: 'number' } }, required: ['id'] },
      handler: async (a) => {
        const r = await client.post(`/priceList/${a.id}/unlock`);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ Ceník ID ${a.id} odemčen.`;
      },
    },
    {
      name: 'polozky_ceniku',
      description: 'Vypíše položky ceníku.',
      inputSchema: { type: 'object', properties: {
        cenikId: { type: 'number' }, limit: { type: 'number', default: 50 }, offset: { type: 'number', default: 0 },
      }, required: ['cenikId'] },
      handler: async (a) => {
        const r = await client.get(`/priceList/${a.cenikId}/items/`, { limit: a.limit||50, offset: a.offset||0 });
        if (!r.success) return `Chyba: ${r.error}`;
        const d = Array.isArray(r.data) ? r.data : [];
        if (!d.length) return 'Ceník neobsahuje žádné položky.';
        return `**Položky ceníku ID ${a.cenikId} (${d.length}):**\n` +
          d.map(p => `- ${p.product?.name||p.name||'-'} | Cena: ${p.price||0} Kč`).join('\n');
      },
    },
    {
      name: 'pridej_polozku_ceniku',
      description: 'Přidá položku do ceníku.',
      inputSchema: { type: 'object', properties: {
        cenikId: { type: 'number' }, produktId: { type: 'number' }, cena: { type: 'number' },
      }, required: ['cenikId','produktId','cena'] },
      handler: async (a) => {
        const body = R.body({ product: R.ref(a.produktId), price: a.cena });
        const r = await client.put(`/priceList/${a.cenikId}/item/`, body);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ Položka přidána do ceníku ${a.cenikId}.`;
      },
    },
    {
      name: 'smaz_polozku_ceniku',
      description: 'Smaže položku z ceníku.',
      inputSchema: { type: 'object', properties: {
        cenikId: { type: 'number' }, polozkaId: { type: 'number' },
      }, required: ['cenikId','polozkaId'] },
      handler: async (a) => {
        const r = await client.del(`/priceList/${a.cenikId}/item/${a.polozkaId}/`);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ Položka ID ${a.polozkaId} smazána z ceníku.`;
      },
    },
    {
      name: 'firmy_ceniku',
      description: 'Zobrazí firmy s přiřazeným ceníkem.',
      inputSchema: { type: 'object', properties: { cenikId: { type: 'number' } }, required: ['cenikId'] },
      handler: async (a) => {
        const r = await client.get(`/priceList/${a.cenikId}/company/`);
        if (!r.success) return `Chyba: ${r.error}`;
        const d = Array.isArray(r.data) ? r.data : [];
        if (!d.length) return 'Žádné firmy nemají tento ceník přiřazený.';
        return `**Firmy s ceníkem ID ${a.cenikId}:**\n` + d.map(f => `- ${f.name} (ID: ${f.id})`).join('\n');
      },
    },

    // ═══════════════════════════════════════════════════════════════
    // ČÍSELNÍKY — ZÁKLADNÍ (Picklists)
    // ═══════════════════════════════════════════════════════════════
    {
      name: 'faze_op',
      description: 'Vypíše fáze obchodních případů.',
      inputSchema: { type: 'object', properties: {} },
      handler: async () => {
        const r = await client.get('/businessCasePhase/');
        if (!r.success) return `Chyba: ${r.error}`;
        const d = Array.isArray(r.data) ? r.data : [];
        return `**Fáze OP:**\n` + d.map(f => `- ${f.name||f.code01} (ID: ${f.id}, pravd: ${f.probability||0}%)`).join('\n');
      },
    },
    {
      name: 'typy_op',
      description: 'Vypíše typy obchodních případů.',
      inputSchema: { type: 'object', properties: {} },
      handler: async () => {
        const r = await client.get('/businessCaseType/');
        if (!r.success) return `Chyba: ${r.error}`;
        const d = Array.isArray(r.data) ? r.data : [];
        return `**Typy OP:**\n` + d.map(t => `- ${t.name||t.code01} (ID: ${t.id})`).join('\n');
      },
    },
    {
      name: 'faze_leadu',
      description: 'Vypíše fáze/stavy leadů.',
      inputSchema: { type: 'object', properties: {} },
      handler: async () => {
        const r = await client.get('/leadPhase/');
        if (!r.success) return `Chyba: ${r.error}`;
        const d = Array.isArray(r.data) ? r.data : [];
        return `**Fáze leadů:**\n` + d.map(f => `- ${f.name||f.code01} (ID: ${f.id})`).join('\n');
      },
    },
    {
      name: 'kategorie_firem',
      description: 'Vypíše kategorie firem.',
      inputSchema: { type: 'object', properties: {} },
      handler: async () => {
        const r = await client.get('/companyCategory/');
        if (!r.success) return `Chyba: ${r.error}`;
        const d = Array.isArray(r.data) ? r.data : [];
        return `**Kategorie firem:**\n` + d.map(k => `- ${k.name} (ID: ${k.id})`).join('\n');
      },
    },
    {
      name: 'kategorie_kontaktu',
      description: 'Vypíše kategorie kontaktů.',
      inputSchema: { type: 'object', properties: {} },
      handler: async () => {
        const r = await client.get('/personCategory/');
        if (!r.success) return `Chyba: ${r.error}`;
        const d = Array.isArray(r.data) ? r.data : [];
        return `**Kategorie kontaktů:**\n` + d.map(k => `- ${k.name} (ID: ${k.id})`).join('\n');
      },
    },
    {
      name: 'kategorie_produktu',
      description: 'Vypíše kategorie produktů.',
      inputSchema: { type: 'object', properties: {} },
      handler: async () => {
        const r = await client.get('/productCategory/');
        if (!r.success) return `Chyba: ${r.error}`;
        const d = Array.isArray(r.data) ? r.data : [];
        return `**Kategorie produktů:**\n` + d.map(k => `- ${k.name} (ID: ${k.id})`).join('\n');
      },
    },
    {
      name: 'produktove_rady',
      description: 'Vypíše produktové řady.',
      inputSchema: { type: 'object', properties: {} },
      handler: async () => {
        const r = await client.get('/productLine/');
        if (!r.success) return `Chyba: ${r.error}`;
        const d = Array.isArray(r.data) ? r.data : [];
        return `**Produktové řady:**\n` + d.map(p => `- ${p.name} (ID: ${p.id})`).join('\n');
      },
    },
    {
      name: 'kategorie_nabidek',
      description: 'Vypíše kategorie nabídek.',
      inputSchema: { type: 'object', properties: {} },
      handler: async () => {
        const r = await client.get('/offerCategory/');
        if (!r.success) return `Chyba: ${r.error}`;
        const d = Array.isArray(r.data) ? r.data : [];
        return `**Kategorie nabídek:**\n` + d.map(k => `- ${k.name} (ID: ${k.id})`).join('\n');
      },
    },
    {
      name: 'stavy_nabidek',
      description: 'Vypíše stavy nabídek.',
      inputSchema: { type: 'object', properties: {} },
      handler: async () => {
        const r = await client.get('/offerStatus/');
        if (!r.success) return `Chyba: ${r.error}`;
        const d = Array.isArray(r.data) ? r.data : [];
        return `**Stavy nabídek:**\n` + d.map(s => `- ${s.name} (ID: ${s.id})`).join('\n');
      },
    },
    {
      name: 'kategorie_objednavek',
      description: 'Vypíše kategorie objednávek.',
      inputSchema: { type: 'object', properties: {} },
      handler: async () => {
        const r = await client.get('/salesOrderCategory/');
        if (!r.success) return `Chyba: ${r.error}`;
        const d = Array.isArray(r.data) ? r.data : [];
        return `**Kategorie objednávek:**\n` + d.map(k => `- ${k.name} (ID: ${k.id})`).join('\n');
      },
    },
    {
      name: 'stavy_objednavek',
      description: 'Vypíše stavy objednávek.',
      inputSchema: { type: 'object', properties: {} },
      handler: async () => {
        const r = await client.get('/salesOrderStatus/');
        if (!r.success) return `Chyba: ${r.error}`;
        const d = Array.isArray(r.data) ? r.data : [];
        return `**Stavy objednávek:**\n` + d.map(s => `- ${s.name} (ID: ${s.id})`).join('\n');
      },
    },
    {
      name: 'kategorie_op',
      description: 'Vypíše kategorie obchodních případů.',
      inputSchema: { type: 'object', properties: {} },
      handler: async () => {
        const r = await client.get('/businessCaseCategory/');
        if (!r.success) return `Chyba: ${r.error}`;
        const d = Array.isArray(r.data) ? r.data : [];
        return `**Kategorie OP:**\n` + d.map(k => `- ${k.name} (ID: ${k.id})`).join('\n');
      },
    },
    {
      name: 'kategorie_projektu',
      description: 'Vypíše kategorie projektů.',
      inputSchema: { type: 'object', properties: {} },
      handler: async () => {
        const r = await client.get('/projectCategory/');
        if (!r.success) return `Chyba: ${r.error}`;
        const d = Array.isArray(r.data) ? r.data : [];
        return `**Kategorie projektů:**\n` + d.map(k => `- ${k.name} (ID: ${k.id})`).join('\n');
      },
    },
    {
      name: 'stavy_projektu',
      description: 'Vypíše stavy projektů.',
      inputSchema: { type: 'object', properties: {} },
      handler: async () => {
        const r = await client.get('/projectStatus/');
        if (!r.success) return `Chyba: ${r.error}`;
        const d = Array.isArray(r.data) ? r.data : [];
        return `**Stavy projektů:**\n` + d.map(s => `- ${s.name} (ID: ${s.id})`).join('\n');
      },
    },
    {
      name: 'kategorie_ceniku',
      description: 'Vypíše kategorie ceníků.',
      inputSchema: { type: 'object', properties: {} },
      handler: async () => {
        const r = await client.get('/priceListCategory/');
        if (!r.success) return `Chyba: ${r.error}`;
        const d = Array.isArray(r.data) ? r.data : [];
        return `**Kategorie ceníků:**\n` + d.map(k => `- ${k.name} (ID: ${k.id})`).join('\n');
      },
    },
    {
      name: 'kategorie_leadu',
      description: 'Vypíše kategorie leadů.',
      inputSchema: { type: 'object', properties: {} },
      handler: async () => {
        const r = await client.get('/leadCategory/');
        if (!r.success) return `Chyba: ${r.error}`;
        const d = Array.isArray(r.data) ? r.data : [];
        return `**Kategorie leadů:**\n` + d.map(k => `- ${k.name} (ID: ${k.id})`).join('\n');
      },
    },
    {
      name: 'kategorie_aktivit',
      description: 'Vypíše kategorie aktivit.',
      inputSchema: { type: 'object', properties: {} },
      handler: async () => {
        const r = await client.get('/activityCategory/');
        if (!r.success) return `Chyba: ${r.error}`;
        const d = Array.isArray(r.data) ? r.data : [];
        return `**Kategorie aktivit:**\n` + d.map(k => `- ${k.name} (ID: ${k.id})`).join('\n');
      },
    },
    {
      name: 'kategorie_dokumentu',
      description: 'Vypíše kategorie dokumentů.',
      inputSchema: { type: 'object', properties: {} },
      handler: async () => {
        const r = await client.get('/documentCategory/');
        if (!r.success) return `Chyba: ${r.error}`;
        const d = Array.isArray(r.data) ? r.data : [];
        return `**Kategorie dokumentů:**\n` + d.map(k => `- ${k.name} (ID: ${k.id})`).join('\n');
      },
    },
    {
      name: 'sazby_dph',
      description: 'Vypíše sazby DPH.',
      inputSchema: { type: 'object', properties: {} },
      handler: async () => {
        const r = await client.get('/taxRate/');
        if (!r.success) return `Chyba: ${r.error}`;
        const d = Array.isArray(r.data) ? r.data : [];
        return `**Sazby DPH:**\n` + d.map(s => `- ${s.name}: ${s.rate||s.value||'-'}% (ID: ${s.id})`).join('\n');
      },
    },
    {
      name: 'meny',
      description: 'Vypíše dostupné měny.',
      inputSchema: { type: 'object', properties: {} },
      handler: async () => {
        const r = await client.get('/currency/');
        if (!r.success) return `Chyba: ${r.error}`;
        const d = Array.isArray(r.data) ? r.data : [];
        return `**Měny:**\n` + d.map(m => `- ${m.name||m.code01||'N/A'} (kód: ${m.code02||m.code01||'-'}, ID: ${m.id})`).join('\n');
      },
    },
    {
      name: 'pravni_formy',
      description: 'Vypíše právní formy.',
      inputSchema: { type: 'object', properties: {} },
      handler: async () => {
        const r = await client.get('/legalForm/');
        if (!r.success) return `Chyba: ${r.error}`;
        const d = Array.isArray(r.data) ? r.data : [];
        return `**Právní formy:**\n` + d.map(f => `- ${f.name} (ID: ${f.id})`).join('\n');
      },
    },
    {
      name: 'zdroje_kontaktu',
      description: 'Vypíše zdroje kontaktů.',
      inputSchema: { type: 'object', properties: {} },
      handler: async () => {
        const r = await client.get('/contactSource/');
        if (!r.success) return `Chyba: ${r.error}`;
        const d = Array.isArray(r.data) ? r.data : [];
        return `**Zdroje kontaktů:**\n` + d.map(z => `- ${z.name} (ID: ${z.id})`).join('\n');
      },
    },
    {
      name: 'obory_podnikani',
      description: 'Vypíše obory podnikání.',
      inputSchema: { type: 'object', properties: {} },
      handler: async () => {
        const r = await client.get('/economyActivity/');
        if (!r.success) return `Chyba: ${r.error}`;
        const d = Array.isArray(r.data) ? r.data : [];
        return `**Obory podnikání:**\n` + d.map(o => `- ${o.name} (ID: ${o.id})`).join('\n');
      },
    },
    {
      name: 'pocty_zamestnancu',
      description: 'Vypíše číselník počtů zaměstnanců.',
      inputSchema: { type: 'object', properties: {} },
      handler: async () => {
        const r = await client.get('/employeesNumber/');
        if (!r.success) return `Chyba: ${r.error}`;
        const d = Array.isArray(r.data) ? r.data : [];
        return `**Počty zaměstnanců:**\n` + d.map(p => `- ${p.name} (ID: ${p.id})`).join('\n');
      },
    },
    {
      name: 'platebni_podminky',
      description: 'Vypíše platební podmínky.',
      inputSchema: { type: 'object', properties: {} },
      handler: async () => {
        const r = await client.get('/paymentTerm/');
        if (!r.success) return `Chyba: ${r.error}`;
        const d = Array.isArray(r.data) ? r.data : [];
        return `**Platební podmínky:**\n` + d.map(p => `- ${p.name} (ID: ${p.id})`).join('\n');
      },
    },
    {
      name: 'obraty_firem',
      description: 'Vypíše číselník obratů firem.',
      inputSchema: { type: 'object', properties: {} },
      handler: async () => {
        const r = await client.get('/companyTurnover/');
        if (!r.success) return `Chyba: ${r.error}`;
        const d = Array.isArray(r.data) ? r.data : [];
        return `**Obraty firem:**\n` + d.map(o => `- ${o.name} (ID: ${o.id})`).join('\n');
      },
    },
    {
      name: 'uzemi',
      description: 'Vypíše obchodní území.',
      inputSchema: { type: 'object', properties: {} },
      handler: async () => {
        const r = await client.get('/territory/');
        if (!r.success) return `Chyba: ${r.error}`;
        const d = Array.isArray(r.data) ? r.data : [];
        return `**Obchodní území:**\n` + d.map(u => `- ${u.name} (ID: ${u.id})`).join('\n');
      },
    },
    {
      name: 'typy_telefonu',
      description: 'Vypíše typy telefonních čísel.',
      inputSchema: { type: 'object', properties: {} },
      handler: async () => {
        const r = await client.get('/telType/');
        if (!r.success) return `Chyba: ${r.error}`;
        const d = Array.isArray(r.data) ? r.data : [];
        return `**Typy telefonů:**\n` + d.map(t => `- ${t.name} (ID: ${t.id})`).join('\n');
      },
    },
    {
      name: 'jazyky',
      description: 'Vypíše jazyky.',
      inputSchema: { type: 'object', properties: {} },
      handler: async () => {
        const r = await client.get('/language/');
        if (!r.success) return `Chyba: ${r.error}`;
        const d = Array.isArray(r.data) ? r.data : [];
        return `**Jazyky:**\n` + d.map(j => `- ${j.name} (ID: ${j.id})`).join('\n');
      },
    },
    {
      name: 'rodinne_stavy',
      description: 'Vypíše rodinné stavy.',
      inputSchema: { type: 'object', properties: {} },
      handler: async () => {
        const r = await client.get('/maritalStatus/');
        if (!r.success) return `Chyba: ${r.error}`;
        const d = Array.isArray(r.data) ? r.data : [];
        return `**Rodinné stavy:**\n` + d.map(s => `- ${s.name} (ID: ${s.id})`).join('\n');
      },
    },
    {
      name: 'duvody_prohry',
      description: 'Vypíše kategorie důvodů prohry obchodního případu.',
      inputSchema: { type: 'object', properties: {} },
      handler: async () => {
        const r = await client.get('/losingCategory/');
        if (!r.success) return `Chyba: ${r.error}`;
        const d = Array.isArray(r.data) ? r.data : [];
        return `**Důvody prohry:**\n` + d.map(d => `- ${d.name} (ID: ${d.id})`).join('\n');
      },
    },
    {
      name: 'klasifikace_firem_1',
      description: 'Vypíše klasifikaci 1 pro firmy.',
      inputSchema: { type: 'object', properties: {} },
      handler: async () => {
        const r = await client.get('/companyClassification1/');
        if (!r.success) return `Chyba: ${r.error}`;
        const d = Array.isArray(r.data) ? r.data : [];
        return `**Klasifikace firem 1:**\n` + d.map(k => `- ${k.name} (ID: ${k.id})`).join('\n');
      },
    },
    {
      name: 'klasifikace_firem_2',
      description: 'Vypíše klasifikaci 2 pro firmy.',
      inputSchema: { type: 'object', properties: {} },
      handler: async () => {
        const r = await client.get('/companyClassification2/');
        if (!r.success) return `Chyba: ${r.error}`;
        const d = Array.isArray(r.data) ? r.data : [];
        return `**Klasifikace firem 2:**\n` + d.map(k => `- ${k.name} (ID: ${k.id})`).join('\n');
      },
    },
    {
      name: 'klasifikace_firem_3',
      description: 'Vypíše klasifikaci 3 pro firmy.',
      inputSchema: { type: 'object', properties: {} },
      handler: async () => {
        const r = await client.get('/companyClassification3/');
        if (!r.success) return `Chyba: ${r.error}`;
        const d = Array.isArray(r.data) ? r.data : [];
        return `**Klasifikace firem 3:**\n` + d.map(k => `- ${k.name} (ID: ${k.id})`).join('\n');
      },
    },
    {
      name: 'klasifikace_kontaktu_1',
      description: 'Vypíše klasifikaci 1 pro kontakty.',
      inputSchema: { type: 'object', properties: {} },
      handler: async () => {
        const r = await client.get('/personClassification1/');
        if (!r.success) return `Chyba: ${r.error}`;
        const d = Array.isArray(r.data) ? r.data : [];
        return `**Klasifikace kontaktů 1:**\n` + d.map(k => `- ${k.name} (ID: ${k.id})`).join('\n');
      },
    },
    {
      name: 'klasifikace_kontaktu_2',
      description: 'Vypíše klasifikaci 2 pro kontakty.',
      inputSchema: { type: 'object', properties: {} },
      handler: async () => {
        const r = await client.get('/personClassification2/');
        if (!r.success) return `Chyba: ${r.error}`;
        const d = Array.isArray(r.data) ? r.data : [];
        return `**Klasifikace kontaktů 2:**\n` + d.map(k => `- ${k.name} (ID: ${k.id})`).join('\n');
      },
    },
    {
      name: 'klasifikace_kontaktu_3',
      description: 'Vypíše klasifikaci 3 pro kontakty.',
      inputSchema: { type: 'object', properties: {} },
      handler: async () => {
        const r = await client.get('/personClassification3/');
        if (!r.success) return `Chyba: ${r.error}`;
        const d = Array.isArray(r.data) ? r.data : [];
        return `**Klasifikace kontaktů 3:**\n` + d.map(k => `- ${k.name} (ID: ${k.id})`).join('\n');
      },
    },
    {
      name: 'klasifikace_op_1',
      description: 'Vypíše klasifikaci 1 pro obchodní případy.',
      inputSchema: { type: 'object', properties: {} },
      handler: async () => {
        const r = await client.get('/businessCaseClassification1/');
        if (!r.success) return `Chyba: ${r.error}`;
        const d = Array.isArray(r.data) ? r.data : [];
        return `**Klasifikace OP 1:**\n` + d.map(k => `- ${k.name} (ID: ${k.id})`).join('\n');
      },
    },
    {
      name: 'klasifikace_op_2',
      description: 'Vypíše klasifikaci 2 pro obchodní případy.',
      inputSchema: { type: 'object', properties: {} },
      handler: async () => {
        const r = await client.get('/businessCaseClassification2/');
        if (!r.success) return `Chyba: ${r.error}`;
        const d = Array.isArray(r.data) ? r.data : [];
        return `**Klasifikace OP 2:**\n` + d.map(k => `- ${k.name} (ID: ${k.id})`).join('\n');
      },
    },
    {
      name: 'klasifikace_op_3',
      description: 'Vypíše klasifikaci 3 pro obchodní případy.',
      inputSchema: { type: 'object', properties: {} },
      handler: async () => {
        const r = await client.get('/businessCaseClassification3/');
        if (!r.success) return `Chyba: ${r.error}`;
        const d = Array.isArray(r.data) ? r.data : [];
        return `**Klasifikace OP 3:**\n` + d.map(k => `- ${k.name} (ID: ${k.id})`).join('\n');
      },
    },
    {
      name: 'kategorie_ucast_op',
      description: 'Vypíše kategorie účasti na obchodním případu.',
      inputSchema: { type: 'object', properties: {} },
      handler: async () => {
        const r = await client.get('/businessCaseRelationshipCategory/');
        if (!r.success) return `Chyba: ${r.error}`;
        const d = Array.isArray(r.data) ? r.data : [];
        return `**Kategorie účasti OP:**\n` + d.map(k => `- ${k.name} (ID: ${k.id})`).join('\n');
      },
    },
    {
      name: 'kategorie_ucast_projektu',
      description: 'Vypíše kategorie účasti na projektu.',
      inputSchema: { type: 'object', properties: {} },
      handler: async () => {
        const r = await client.get('/projectRelationshipCategory/');
        if (!r.success) return `Chyba: ${r.error}`;
        const d = Array.isArray(r.data) ? r.data : [];
        return `**Kategorie účasti projektů:**\n` + d.map(k => `- ${k.name} (ID: ${k.id})`).join('\n');
      },
    },

    // ═══════════════════════════════════════════════════════════════
    // UŽIVATELÉ & BEZPEČNOSTNÍ ÚROVNĚ
    // ═══════════════════════════════════════════════════════════════
    {
      name: 'uzivatele',
      description: 'Vypíše uživatele Raynetu.',
      inputSchema: { type: 'object', properties: {} },
      handler: async () => {
        const r = await client.get('/userAccount/');
        if (!r.success) return `Chyba: ${r.error}`;
        const d = Array.isArray(r.data) ? r.data : [];
        return `**Uživatelé (${d.length}):**\n` + d.map(u => `- ${u.fullName||u.login} (ID: ${u.id}, email: ${u.email||'-'})`).join('\n');
      },
    },
    {
      name: 'detail_uzivatele',
      description: 'Detail uživatele.',
      inputSchema: { type: 'object', properties: { id: { type: 'number' } }, required: ['id'] },
      handler: async (a) => {
        const r = await client.get(`/userAccount/${a.id}/`);
        if (!r.success) return `Chyba: ${r.error}`;
        const u = r.data;
        return `**${u.fullName||u.login}** (ID: ${u.id})\n- Email: ${u.email||'-'}\n- Aktivní: ${u.validFlag ? 'Ano' : 'Ne'}`;
      },
    },
    {
      name: 'seznam_bezpecnostnich_urovni',
      description: 'Vypíše bezpečnostní úrovně.',
      inputSchema: { type: 'object', properties: {} },
      handler: async () => {
        const r = await client.get('/securityLevel/');
        if (!r.success) return `Chyba: ${r.error}`;
        const d = Array.isArray(r.data) ? r.data : [];
        return `**Bezpečnostní úrovně:**\n` + d.map(b => `- ${b.name} (ID: ${b.id})`).join('\n');
      },
    },

    // ═══════════════════════════════════════════════════════════════
    // VOLITELNÁ POLE & KONFIGURACE
    // ═══════════════════════════════════════════════════════════════
    {
      name: 'konfigurace_volitelnych_poli',
      description: 'Zobrazí konfiguraci volitelných polí pro danou entitu.',
      inputSchema: { type: 'object', properties: {
        entita: { type: 'string', enum: ['company','person','businessCase','offer','salesOrder','project','lead','product'] },
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
      name: 'moznosti_volitelneho_pole',
      description: 'Vypíše možnosti (enum) pro pole typu picklist.',
      inputSchema: { type: 'object', properties: {
        entita: { type: 'string' }, nazevPole: { type: 'string' },
      }, required: ['entita','nazevPole'] },
      handler: async (a) => {
        const r = await client.get(`/customField/enum/${a.entita}/${a.nazevPole}/`);
        if (!r.success) return `Chyba: ${r.error}`;
        const d = Array.isArray(r.data) ? r.data : [];
        return `**Možnosti pole "${a.nazevPole}":**\n` + d.map(m => `- ${m.label||m.value} (hodnota: ${m.value})`).join('\n');
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

    // ═══════════════════════════════════════════════════════════════
    // TAGY, KOMENTÁŘE, SLEDOVATELÉ
    // ═══════════════════════════════════════════════════════════════
    {
      name: 'pridej_tag',
      description: 'Přidá tag k záznamu.',
      inputSchema: { type: 'object', properties: {
        entita: { type: 'string', enum: ['company','person','businessCase','offer','project','lead','salesOrder','task','meeting','phoneCall'] },
        zaznamId: { type: 'number' }, tag: { type: 'string' },
      }, required: ['entita','zaznamId','tag'] },
      handler: async (a) => {
        const r = await client.put(`/${a.entita}/${a.zaznamId}/tag/`, { tag: a.tag });
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ Tag "${a.tag}" přidán.`;
      },
    },
    {
      name: 'smaz_tag',
      description: 'Odstraní tag ze záznamu.',
      inputSchema: { type: 'object', properties: {
        entita: { type: 'string' }, zaznamId: { type: 'number' }, tag: { type: 'string' },
      }, required: ['entita','zaznamId','tag'] },
      handler: async (a) => {
        const r = await client.del(`/${a.entita}/${a.zaznamId}/tag/`);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ Tag odstraněn.`;
      },
    },
    {
      name: 'pridej_komentar',
      description: 'Přidá komentář k záznamu.',
      inputSchema: { type: 'object', properties: {
        entita: { type: 'string', enum: ['company','person','businessCase','offer','project','lead','salesOrder'] },
        zaznamId: { type: 'number' }, komentar: { type: 'string' },
      }, required: ['entita','zaznamId','komentar'] },
      handler: async (a) => {
        const r = await client.put(`/${a.entita}/${a.zaznamId}/post/`, { comment: a.komentar });
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ Komentář přidán.`;
      },
    },
    {
      name: 'seznam_komentaru',
      description: 'Zobrazí komentáře (diskusi) u záznamu.',
      inputSchema: { type: 'object', properties: {
        entita: { type: 'string' }, zaznamId: { type: 'number' },
      }, required: ['entita','zaznamId'] },
      handler: async (a) => {
        const r = await client.get(`/${a.entita}/${a.zaznamId}/post/`);
        if (!r.success) return `Chyba: ${r.error}`;
        const d = Array.isArray(r.data) ? r.data : [];
        if (!d.length) return 'Žádné komentáře.';
        return `**Komentáře:**\n` + d.map(k => `[${k.createdAt||'-'}] ${k.createdBy?.fullName||'-'}: ${k.comment||'-'}`).join('\n');
      },
    },
    {
      name: 'smaz_komentar',
      description: 'Smaže komentář ze záznamu.',
      inputSchema: { type: 'object', properties: {
        entita: { type: 'string' }, zaznamId: { type: 'number' }, komentarId: { type: 'number' },
      }, required: ['entita','zaznamId','komentarId'] },
      handler: async (a) => {
        const r = await client.del(`/${a.entita}/${a.zaznamId}/post/${a.komentarId}/`);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ Komentář ID ${a.komentarId} smazán.`;
      },
    },
    {
      name: 'seznam_sledovatelu',
      description: 'Zobrazí sledovatele diskuse u záznamu.',
      inputSchema: { type: 'object', properties: {
        entita: { type: 'string' }, zaznamId: { type: 'number' },
      }, required: ['entita','zaznamId'] },
      handler: async (a) => {
        const r = await client.get(`/${a.entita}/${a.zaznamId}/watcher/`);
        if (!r.success) return `Chyba: ${r.error}`;
        const d = Array.isArray(r.data) ? r.data : [];
        if (!d.length) return 'Žádní sledovatelé.';
        return `**Sledovatelé:**\n` + d.map(s => `- ${s.fullName||s.login||'-'} (ID: ${s.id})`).join('\n');
      },
    },
    {
      name: 'pridej_sledovatele',
      description: 'Přidá sledovatele k záznamu.',
      inputSchema: { type: 'object', properties: {
        entita: { type: 'string' }, zaznamId: { type: 'number' }, kontaktId: { type: 'number' },
      }, required: ['entita','zaznamId','kontaktId'] },
      handler: async (a) => {
        const r = await client.put(`/${a.entita}/${a.zaznamId}/watcher/${a.kontaktId}/`);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ Sledovatel přidán.`;
      },
    },
    {
      name: 'smaz_sledovatele',
      description: 'Odebere sledovatele ze záznamu.',
      inputSchema: { type: 'object', properties: {
        entita: { type: 'string' }, zaznamId: { type: 'number' }, kontaktId: { type: 'number' },
      }, required: ['entita','zaznamId','kontaktId'] },
      handler: async (a) => {
        const r = await client.del(`/${a.entita}/${a.zaznamId}/watcher/${a.kontaktId}/`);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ Sledovatel odebrán.`;
      },
    },

    // ═══════════════════════════════════════════════════════════════
    // EXTERNÍ ID
    // ═══════════════════════════════════════════════════════════════
    {
      name: 'pridej_externi_id',
      description: 'Přidá externí ID k záznamu (pro integraci s jinými systémy).',
      inputSchema: { type: 'object', properties: {
        entita: { type: 'string' }, zaznamId: { type: 'number' },
        extId: { type: 'string' }, kod: { type: 'string', description: 'Kód externího systému' },
      }, required: ['entita','zaznamId','extId','kod'] },
      handler: async (a) => {
        const body = { extId: a.extId, code: a.kod };
        const r = await client.put(`/${a.entita}/${a.zaznamId}/extId/`, body);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ Externí ID přidáno.`;
      },
    },
    {
      name: 'smaz_externi_id',
      description: 'Smaže externí ID záznamu.',
      inputSchema: { type: 'object', properties: {
        entita: { type: 'string' }, zaznamId: { type: 'number' }, extId: { type: 'string' },
      }, required: ['entita','zaznamId','extId'] },
      handler: async (a) => {
        const r = await client.del(`/${a.entita}/${a.zaznamId}/extId/${a.extId}`);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ Externí ID smazáno.`;
      },
    },

    // ═══════════════════════════════════════════════════════════════
    // WEBHOOKY
    // ═══════════════════════════════════════════════════════════════
    {
      name: 'seznam_webhooku',
      description: 'Vypíše seznam webhooků.',
      inputSchema: { type: 'object', properties: {} },
      handler: async () => {
        const r = await client.get('/webhook/');
        if (!r.success) return `Chyba: ${r.error}`;
        const d = Array.isArray(r.data) ? r.data : [];
        if (!d.length) return 'Žádné webhooky.';
        return `**Webhooky (${d.length}):**\n` + d.map(w => `- ${w.url} | Entita: ${w.entity||'-'} | UUID: ${w.uuid||'-'}`).join('\n');
      },
    },
    {
      name: 'vytvor_webhook',
      description: 'Vytvoří nový webhook.',
      inputSchema: { type: 'object', properties: {
        url: { type: 'string' }, entita: { type: 'string' }, akce: { type: 'string' },
      }, required: ['url','entita'] },
      handler: async (a) => {
        const body = R.body({ url: a.url, entity: a.entita, action: a.akce });
        const r = await client.put('/webhook/', body);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ Webhook vytvořen.`;
      },
    },
    {
      name: 'smaz_webhook',
      description: 'Smaže webhook podle UUID.',
      inputSchema: { type: 'object', properties: { uuid: { type: 'string' } }, required: ['uuid'] },
      handler: async (a) => {
        const r = await client.del(`/webhook/${a.uuid}/`);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ Webhook ${a.uuid} smazán.`;
      },
    },

    // ═══════════════════════════════════════════════════════════════
    // NOTIFIKACE
    // ═══════════════════════════════════════════════════════════════
    {
      name: 'seznam_notifikaci',
      description: 'Vypíše notifikace uživatele.',
      inputSchema: { type: 'object', properties: {
        limit: { type: 'number', default: 20 }, offset: { type: 'number', default: 0 },
      }},
      handler: async (a) => {
        const r = await client.get('/notification/', { limit: a.limit||20, offset: a.offset||0 });
        if (!r.success) return `Chyba: ${r.error}`;
        const d = Array.isArray(r.data) ? r.data : [];
        if (!d.length) return 'Žádné notifikace.';
        return `**Notifikace (${d.length}):**\n` + d.map(n => `- [${n.createdAt||'-'}] ${n.message||n.text||'-'} (ID: ${n.id})`).join('\n');
      },
    },
    {
      name: 'smaz_notifikaci',
      description: 'Smaže notifikaci.',
      inputSchema: { type: 'object', properties: { id: { type: 'number' } }, required: ['id'] },
      handler: async (a) => {
        const r = await client.del(`/notification/${a.id}/`);
        if (!r.success) return `Chyba: ${r.error}`;
        return `✅ Notifikace ID ${a.id} smazána.`;
      },
    },

    // ═══════════════════════════════════════════════════════════════
    // GDPR
    // ═══════════════════════════════════════════════════════════════
    {
      name: 'seznam_gdpr',
      description: 'Vypíše seznam právních titulů GDPR.',
      inputSchema: { type: 'object', properties: {
        limit: { type: 'number', default: 20 }, offset: { type: 'number', default: 0 },
      }},
      handler: async (a) => {
        const r = await client.get('/gdpr/', { limit: a.limit||20, offset: a.offset||0 });
        if (!r.success) return `Chyba: ${r.error}`;
        const d = Array.isArray(r.data) ? r.data : [];
        if (!d.length) return 'Žádné GDPR záznamy.';
        return `**GDPR záznamy (${d.length}):**\n` + d.map(g => `- ${g.name||'-'} | Kontakt: ${g.person?.fullName||'-'} | Platnost: ${g.validFrom||'-'}`).join('\n');
      },
    },
    {
      name: 'sablony_gdpr',
      description: 'Vypíše šablony právních titulů GDPR.',
      inputSchema: { type: 'object', properties: {} },
      handler: async () => {
        const r = await client.get('/gdprTemplate/');
        if (!r.success) return `Chyba: ${r.error}`;
        const d = Array.isArray(r.data) ? r.data : [];
        return `**Šablony GDPR:**\n` + d.map(s => `- ${s.name} (ID: ${s.id})`).join('\n');
      },
    },
    {
      name: 'souhlasy_gdpr',
      description: 'Vypíše formuláře souhlasů GDPR.',
      inputSchema: { type: 'object', properties: {} },
      handler: async () => {
        const r = await client.get('/gdprFormAgreement/');
        if (!r.success) return `Chyba: ${r.error}`;
        const d = Array.isArray(r.data) ? r.data : [];
        return `**Souhlasové formuláře GDPR:**\n` + d.map(s => `- ${s.name} (ID: ${s.id})`).join('\n');
      },
    },

    // ═══════════════════════════════════════════════════════════════
    // DOKUMENTY (DMS)
    // ═══════════════════════════════════════════════════════════════
    {
      name: 'seznam_dokumentu',
      description: 'Vypíše obsah složky dokumentů.',
      inputSchema: { type: 'object', properties: {} },
      handler: async () => {
        const r = await client.get('/dms/');
        if (!r.success) return `Chyba: ${r.error}`;
        const d = Array.isArray(r.data) ? r.data : [];
        if (!d.length) return 'Žádné dokumenty/složky.';
        return `**Dokumenty:**\n` + d.map(x => `- [${x.type||'-'}] ${x.name||'-'} (ID: ${x.id})`).join('\n');
      },
    },
    {
      name: 'detail_dokumentu',
      description: 'Detail dokumentu.',
      inputSchema: { type: 'object', properties: { id: { type: 'number' } }, required: ['id'] },
      handler: async (a) => {
        const r = await client.get(`/dms/document/${a.id}/`);
        if (!r.success) return `Chyba: ${r.error}`;
        const d = r.data;
        return `## ${d.name} (ID: ${d.id})\n- Kategorie: ${d.category?.name||'-'}\n- Vlastník: ${d.owner?.fullName||'-'}\n- Vytvořeno: ${d.createdAt||'-'}`;
      },
    },

    // ═══════════════════════════════════════════════════════════════
    // HROMADNÉ EMAILY (Mass Email)
    // ═══════════════════════════════════════════════════════════════
    {
      name: 'seznam_hromadnych_emailu',
      description: 'Vypíše seznam hromadných emailových kampaní.',
      inputSchema: { type: 'object', properties: {
        limit: { type: 'number', default: 20 }, offset: { type: 'number', default: 0 },
      }},
      handler: async (a) => {
        const r = await client.get('/massEmail/', { limit: a.limit||20, offset: a.offset||0 });
        if (!r.success) return `Chyba: ${r.error}`;
        const d = Array.isArray(r.data) ? r.data : [];
        if (!d.length) return 'Žádné hromadné emaily.';
        return `**Hromadné emaily (${d.length}):**\n` + d.map(e => `- ${e.name||e.subject||'-'} (ID: ${e.id}) | Datum: ${e.sentAt||'-'}`).join('\n');
      },
    },
    {
      name: 'detail_hromadneho_emailu',
      description: 'Detail hromadného emailu.',
      inputSchema: { type: 'object', properties: { id: { type: 'number' } }, required: ['id'] },
      handler: async (a) => {
        const r = await client.get(`/massEmail/${a.id}/`);
        if (!r.success) return `Chyba: ${r.error}`;
        const e = r.data;
        return `## ${e.name||e.subject||'-'} (ID: ${e.id})\n- Předmět: ${e.subject||'-'}\n- Datum: ${e.sentAt||'-'}`;
      },
    },
    {
      name: 'seznam_prijemcu_hromadneho_emailu',
      description: 'Vypíše příjemce hromadného emailu.',
      inputSchema: { type: 'object', properties: {
        emailId: { type: 'number' },
        limit: { type: 'number', default: 50 }, offset: { type: 'number', default: 0 },
      }, required: ['emailId'] },
      handler: async (a) => {
        const r = await client.get(`/massEmail/${a.emailId}/recipient/`, { limit: a.limit||50, offset: a.offset||0 });
        if (!r.success) return `Chyba: ${r.error}`;
        const d = Array.isArray(r.data) ? r.data : [];
        if (!d.length) return 'Žádní příjemci.';
        return `**Příjemci emailu ID ${a.emailId} (${d.length}):**\n` +
          d.map(p => `- ${p.email||'-'} | Stav: ${p.status||'-'}`).join('\n');
      },
    },

    // ═══════════════════════════════════════════════════════════════
    // FAKTURY (Invoices - legacy)
    // ═══════════════════════════════════════════════════════════════
    {
      name: 'seznam_faktur',
      description: 'Vypíše seznam faktur (legacy modul).',
      inputSchema: { type: 'object', properties: {
        firmaId: { type: 'number' },
        limit: { type: 'number', default: 20 }, offset: { type: 'number', default: 0 },
      }},
      handler: async (a) => {
        const p = { limit: a.limit||20, offset: a.offset||0 };
        if (a.firmaId) p['company[EQ]'] = a.firmaId;
        const r = await client.get('/invoiceLight/', p);
        if (!r.success) return `Chyba: ${r.error}`;
        const d = Array.isArray(r.data) ? r.data : [];
        if (!d.length) return 'Žádné faktury nenalezeny.';
        return `Nalezeno ${r.totalCount||d.length} faktur:\n\n` +
          d.map(f => `**${f.name||f.code||'-'}** (ID: ${f.id})\n  Firma: ${f.company?.name||'-'} | Částka: ${f.totalAmount||0} Kč`).join('\n\n');
      },
    },
    {
      name: 'detail_faktury',
      description: 'Detail faktury.',
      inputSchema: { type: 'object', properties: { id: { type: 'number' } }, required: ['id'] },
      handler: async (a) => {
        const r = await client.get(`/invoiceLight/${a.id}/`);
        if (!r.success) return `Chyba: ${r.error}`;
        const f = r.data;
        return `## ${f.name||f.code||'-'} (ID: ${f.id})\n- Firma: ${f.company?.name||'-'}\n- Částka: ${f.totalAmount||0} Kč\n- Datum: ${f.issueDate||'-'} | Splatnost: ${f.dueDate||'-'}`;
      },
    },

    // ═══════════════════════════════════════════════════════════════
    // VLASTNÍ TLAČÍTKA
    // ═══════════════════════════════════════════════════════════════
    {
      name: 'seznam_vlastnich_tlacitek',
      description: 'Vypíše konfiguraci vlastních tlačítek v Raynetu.',
      inputSchema: { type: 'object', properties: {} },
      handler: async () => {
        const r = await client.get('/customButton/');
        if (!r.success) return `Chyba: ${r.error}`;
        const d = Array.isArray(r.data) ? r.data : [];
        if (!d.length) return 'Žádná vlastní tlačítka.';
        return `**Vlastní tlačítka (${d.length}):**\n` + d.map(b => `- ${b.name} | Entita: ${b.entity||'-'} | Akce: ${b.action||'-'}`).join('\n');
      },
    },

  ];
}

module.exports = { tools };
