import { createHash } from 'node:crypto';

export type EnglishTranslation = { sourceHash: string; title: string; text: string; aliases: string[] };
export const sourceHash = (title: string, text: string) => createHash('sha256').update(`${title}\n${text}`).digest('hex');

// Only use a prepared translation while its published source is unchanged.
export const english: Record<string, EnglishTranslation> = {
  "faq:legacy-faq-1": {
    "sourceHash": "550e2f963be3f14c1e3104ba73facd277329e4daf2f9a7e9fc106b743baefdcf",
    "title": "What is DPO?",
    "text": "The Deposit Protection Office (DPO) is a state financial organization with department-level status and legal personality. It operates on a non-profit basis, is financially independent, and is supervised by the Bank of the Lao PDR. Its role is to protect the lawful rights and interests of depositors at member commercial banks, strengthen public confidence in the financial system, and contribute to financial and monetary stability in Laos.",
    "aliases": [
      "about DPO",
      "deposit protection office",
      "what does DPO mean",
      "DPO introduction",
      "explain DPO",
      "meaning of DPO",
      "website purpose",
      "what is this office",
      "ສປງແມ່ນຫຍັງ",
      "ກ່ຽວກັບສປງ",
      "ເວັບນີ້ແມ່ນຫຍັງ",
      "ສຳນັກງານນີ້"
    ]
  },
  "faq:legacy-faq-2": {
    "sourceHash": "e8cc22230f931174f7dcc02399c49b02c0abb57041e3f256fbb1d37f6ebfe579",
    "title": "What is deposit protection?",
    "text": "Deposit protection safeguards the lawful rights and interests of people who hold deposits at DPO member institutions. It is part of the Party and State's policy to maintain confidence in the banking and financial system of the Lao PDR.",
    "aliases": [
      "deposit insurance",
      "protect deposits",
      "how deposit insurance works",
      "bank deposit insurance",
      "protecting bank deposits",
      "ການປະກັນເງິນຝາກ",
      "ຄຸ້ມຄອງເງິນຝາກແມ່ນຫຍັງ"
    ]
  },
  "faq:legacy-faq-4": {
    "sourceHash": "0618f613cdd6ebdf13664ab6628eabf367d2a9128d431469bea66a8e0c42e22b",
    "title": "What is a deposit insurance premium?",
    "text": "A deposit insurance premium is the amount that member institutions pay to DPO to contribute to the deposit protection fund. These contributions help the fund grow stronger so that it can provide greater protection for depositors.",
    "aliases": [
      "premiums",
      "insurance premium",
      "deposit protection fund",
      "premium payer",
      "paying insurance premiums",
      "member premium contributions",
      "ຜູ້ຈ່າຍເບ້ຍປະກັນ",
      "ໃຜຈ່າຍຄ່າປະກັນ"
    ]
  },
  "faq:legacy-faq-5": {
    "sourceHash": "ce9b9fd54b736580b06f319bab15b5438d7504b9b73d433ba34caa500065f353",
    "title": "Whose deposits does DPO protect?",
    "text": "DPO protects deposits held by individuals, legal entities and organizations.",
    "aliases": [
      "who is covered",
      "eligible depositors",
      "who is protected",
      "whose money is protected",
      "eligible individuals companies organizations",
      "who can be protected",
      "are business deposits covered",
      "ຜູ້ທີ່ໄດ້ຮັບການປົກປ້ອງ",
      "ເງິນຝາກຂອງໃຜ"
    ]
  },
  "faq:legacy-faq-6": {
    "sourceHash": "9875896b9165936da264ef4cd2195cf860add9d29be7efe777573becdb6468a4",
    "title": "What are individual deposits?",
    "text": "Individual deposits are deposits made by ordinary people at commercial banks or deposit-taking microfinance institutions that have become DPO members under the Decree on Deposit Protection. The current DPO membership list identifies member institutions.",
    "aliases": [
      "personal deposits",
      "individual depositors",
      "personal savings account",
      "individual bank deposits",
      "ຜູ້ຝາກເງິນບຸກຄົນ",
      "ເງິນຝາກສ່ວນບຸກຄົນ",
      "ordinary people deposits",
      "individual savings protection",
      "personal account holder",
      "ບຸກຄົນທົ່ວໄປ",
      "ເງິນຝາກຂອງປະຊາຊົນ"
    ]
  },
  "faq:legacy-faq-7": {
    "sourceHash": "24d429c47413013f2a1225faf31e7c910582c391a9c1f13ec6c212789f1b21c2",
    "title": "What are deposits of legal entities?",
    "text": "These are deposits held by legally registered entities with their own name, office, assets, and legal rights and obligations, such as state-owned, joint-venture and private enterprises and companies.",
    "aliases": [
      "company deposits",
      "corporate deposits",
      "legal entities",
      "companies and legal entities",
      "business accounts",
      "corporate legal entities",
      "ບໍລິສັດ",
      "ນິຕິບຸກຄົນ"
    ]
  },
  "faq:legacy-faq-8": {
    "sourceHash": "529678e1facd583477f7cfa1ecba5662f9915c824666098311a768c5fb8a1be0",
    "title": "What are protected deposits of organizations?",
    "text": "These are deposits held by organizations other than state or international organizations, as specified in Article 9 of the Decree on Deposit Protection. Examples include religious organizations or temples, associations, foundations, and other organizations established for social assistance or specific purposes.",
    "aliases": [
      "organization deposits",
      "foundation deposits",
      "charities foundations and temples",
      "association deposits",
      "ມູນນິທິ",
      "ເງິນຝາກຂອງສະມາຄົມ",
      "temple deposits",
      "religious organizations",
      "association foundation deposits",
      "social assistance organizations",
      "ວັດ",
      "ສະມາຄົມ",
      "ອົງການທາງສາສະໜາ"
    ]
  },
  "faq:legacy-faq-9": {
    "sourceHash": "d8255b75de7f5cf93b0a7c553a2da2cc282d51ae6731622bc0b2388e5c7e502d",
    "title": "When does deposit protection start?",
    "text": "Depositors receive protection as soon as they open an account with a DPO member institution. No separate registration or application form is required. If that institution's business licence is revoked, depositors may apply for payment from DPO in accordance with announcements or notices issued by the Bank of the Lao PDR.",
    "aliases": [
      "when am I protected",
      "register for protection",
      "do I need to register",
      "when are deposits protected",
      "register sign up application form",
      "automatic enrolment",
      "registration required",
      "ການລົງທະບຽນ",
      "ຕ້ອງສະໝັກບໍ",
      "ຕ້ອງຂຽນແບບຟອມບໍ",
      "ເລີ່ມປົກປ້ອງເມື່ອໃດ",
      "when opening a bank account",
      "application for protection",
      "signing up required",
      "ຕ້ອງສະໝັກກ່ອນບໍ",
      "ເປີດບັນຊີແລ້ວໄດ້ປົກປ້ອງບໍ"
    ]
  },
  "faq:legacy-faq-10": {
    "sourceHash": "8c803414a39968dd4f1946b89e56a602ead17fdde6f957c3ba9b4a7e2e93b937",
    "title": "Which types of deposits are protected?",
    "text": "Current-account deposits.\nSavings deposits.\nTerm deposits.",
    "aliases": [
      "covered deposits",
      "protected deposit types",
      "which deposits are covered",
      "savings deposits",
      "protected account types",
      "savings and term accounts",
      "fixed deposits",
      "ປະເພດເງິນຝາກທີ່ຄຸ້ມຄອງ",
      "ເງິນຝາກທີ່ປົກປ້ອງ",
      "current accounts protected",
      "term deposit protection",
      "ຝາກປະຢັດ",
      "ຝາກປະຈຳ",
      "ຝາກກະແສລາຍວັນ"
    ]
  },
  "faq:legacy-faq-11": {
    "sourceHash": "aec499e7029a006efac067972f6a336f713df58d03c20273b4675c46e2a43d55",
    "title": "Which deposits are not protected?",
    "text": "The website lists the following exclusions:\n- Deposits of the institution's own board members, management, department heads and branch heads.\n- Deposits of major shareholders holding at least 10% of the institution's voting shares.\n- Deposits held between financial institutions.\n- National Treasury deposits.\n- Deposits of state organizations, including Party, government and mass organizations at central and local levels.\n- Deposits of international organizations.\n- Deposits for buying and selling securities.\n- Daily deposits.\n- Received guarantee deposits.\n- Inactive deposits.",
    "aliases": [
      "excluded deposits",
      "which deposits are not covered",
      "deposits not protected",
      "unprotected deposits",
      "not covered",
      "excluded account types",
      "unprotected bank deposits",
      "ຂໍ້ຍົກເວັ້ນ",
      "ບໍ່ປົກປ້ອງ",
      "ເງິນຝາກທີ່ບໍ່ຄຸ້ມຄອງ",
      "ປະເພດເງິນຝາກທີ່ບໍ່ຄຸ້ມຄອງ",
      "are inactive deposits protected",
      "are daily deposits covered",
      "are guarantee deposits protected",
      "are major shareholder deposits covered",
      "are treasury deposits protected",
      "are international organization deposits protected",
      "inactive deposit exclusions",
      "ບັນຊີບໍ່ເຄື່ອນໄຫວ",
      "ເງິນຝາກຄ້ຳປະກັນຄຸ້ມຄອງບໍ",
      "ເງິນຝາກຂອງອົງການສາກົນຄຸ້ມຄອງບໍ"
    ]
  },
  "faq:legacy-faq-13": {
    "sourceHash": "eb0ba2f78517b8e708b419ff91cc341f58bb3d6dc04633b63b036f86f741357a",
    "title": "Which institutions can be DPO members?",
    "text": "DPO members include commercial banks and deposit-taking microfinance institutions licensed by the Bank of the Lao PDR. Membership can be identified by a membership certificate displayed at the institution's deposit service point or by checking the current DPO membership list.",
    "aliases": [
      "members",
      "member banks",
      "DPO membership",
      "which banks are members",
      "member institutions",
      "identify member bank",
      "bank membership certificate",
      "check membership",
      "which institutions belong",
      "ລາຍຊື່ສະມາຊິກ",
      "ກວດກາສະມາຊິກ",
      "ທະນາຄານສະມາຊິກ"
    ]
  },
  "faq:legacy-faq-14": {
    "sourceHash": "887f5862eeb434815e47535fb1441dbbc2a38d9aaf49a8f788230265dce562fc",
    "title": "What is deposit protection compensation?",
    "text": "Deposit protection compensation is payment to a depositor per member financial institution when that institution becomes insolvent. Payment is made in Lao kip and includes the principal and interest remaining on the institution's final day of operation, up to the prescribed protection limit. A claim for any balance above that limit must be submitted to the liquidation committee.",
    "aliases": [
      "compensation",
      "payout",
      "reimbursement",
      "how are deposits repaid",
      "payment after bank failure",
      "compensation when bank closes",
      "repaid principal and interest",
      "ຈ່າຍເງິນປົກປ້ອງ",
      "ທະນາຄານລົ້ມລະລາຍ",
      "ການຈ່າຍຊົດເຊີຍ",
      "is interest included in compensation",
      "principal and interest",
      "which currency is compensation paid in",
      "compensation currency Lao kip",
      "claim balance above the protection limit",
      "liquidation committee remaining balance",
      "ດອກເບ້ຍ",
      "ຈ່າຍເປັນເງິນສະກຸນໃດ",
      "ເງິນເກີນວົງເງິນປົກປ້ອງ",
      "ຄະນະກຳມະການຊຳລະສະສາງ"
    ]
  },
  "page:legacy-page-mission": {
    "sourceHash": "266523f916a3c275758c9e2061358cefe32124295a214305a3b8c2caa063a9c7",
    "title": "DPO roles and responsibilities",
    "text": "DPO advises its Board of Directors and the Bank of the Lao PDR on protecting depositors' lawful interests and performs the responsibilities set out in Decree No. 329/GOV of 25 October 2017. The website lists these responsibilities:\n- Research and develop deposit protection strategies and legislation.\n- Conduct research and submit proposals to the Bank of the Lao PDR for consideration.\n- Issue certificates establishing or ending DPO membership.\n- Calculate and collect member premiums at the applicable rates.\n- Monitor and analyse depositors and deposits held at member institutions.\n- Request relevant deposit protection information from members and other parties.\n- Publish deposit protection information for members and the public.\n- Manage DPO capital and its protection fund through low-risk activities, such as government bonds, central bank bonds and deposits at the Bank of the Lao PDR.\n- Propose borrowing from domestic and foreign institutions with a government guarantee, on the recommendation of the Bank of the Lao PDR.\n- Pay compensation within the protection limit specified in Article 11 of the Decree.\n- Recover debts during liquidation and coordinate with departments of the Bank of the Lao PDR and other relevant parties.\n- Regularly report deposit protection activities to the Bank of the Lao PDR.\n- Exercise other rights and duties provided by laws and regulations.",
    "aliases": [
      "duties",
      "roles",
      "responsibilities",
      "what does DPO do",
      "DPO mission",
      "office responsibilities",
      "DPO purpose",
      "DPO functions purpose duties",
      "ສປງເຮັດວຽກຫຍັງ",
      "ວຽກງານສປງ",
      "ໜ້າທີ່ຂອງສຳນັກງານ"
    ]
  },
  "page:legacy-page-history": {
    "sourceHash": "f222a12942928678f4f9d59cae99f430aa37e11746763f7de6141b5b3bba6140",
    "title": "History and establishment of DPO",
    "text": "On 23 January 2019, the change from a state enterprise to a state financial organization and the change of name from the Depositor Protection Fund to the Deposit Protection Office were announced. DPO has department-level status and legal personality, operates on a non-profit basis, is financially independent and is supervised by the Bank of the Lao PDR.\n\nDuring 2014–2017, the Bank of the Lao PDR worked to upgrade the regulatory framework. Decree on Deposit Protection No. 329/GOV was issued on 25 October 2017. The Bank issued Agreement No. 52/BOL on 16 January 2019 establishing the Deposit Protection Office, followed by Agreement No. 68/BOL on 22 January 2019 on its organization and operation.\n\nThe Minister of Finance issued establishment Agreement No. 1285/MOF on 23 September 1999. The Bank of the Lao PDR issued establishment Licence No. 388/BOL on 7 December 1999. The Fund was wholly state-owned, received initial registered capital of 100 million kip from the Ministry of Finance, and operated under Regulation No. 283/BOL of 30 August 1999. This historical registered capital is separate from the deposit protection limit.\n\nThe website describes the international development of deposit protection following financial crises, including the establishment of the first deposit insurer in the United States in 1933 and developments in the Asia-Pacific region. Following the 1997–1998 Asian financial crisis and preparations involving the Bank of the Lao PDR and ADB, Laos established the Depositor Protection Fund at the end of 1999.\n\nThe history page lists several former office locations: initially with the Bank of the Lao PDR in Xieng Yeun village; Nong Duang village in 2008; Don Koy village from 2009 to June 2019; and, from July 2019, the fourth floor of the Securities Commission Office building on Kaysone Road, Phon Sa-at village, Xaysettha district, Vientiane Capital. Use the contact page for the website's current contact details.",
    "aliases": [
      "DPO history",
      "when was DPO established",
      "DPO founding date",
      "when did the fund become the office",
      "ສປງສ້າງຕັ້ງເມື່ອໃດ",
      "ປະຫວັດສປງ",
      "ກອງທຶນປົກປ້ອງຜູ້ຝາກເງິນ"
    ]
  },
  "page:wordpress-page-2535": {
    "sourceHash": "b117345161d5a650981d8e2e23cd3ec0ee0eb9a57ad83f5f58f9517b9209c1ec",
    "title": "DPO organizational structure and divisions",
    "text": "The organizational structure page lists:\n- Personnel and Operation Division.\n- Accounting and Fund Management Division.\n- Analysis and Payout Supervision Division.\n- Internal Audit Division.\n- FSNP project.",
    "aliases": [
      "DPO departments",
      "which divisions does DPO have",
      "organizational chart",
      "ພະແນກຂອງສປງ",
      "ໂຄງຮ່າງສາຍລັດ"
    ]
  },
  "page:wordpress-page-1393": {
    "sourceHash": "f7a573cb2f93a2ee7cbdd19b0369e70f83a8eeb2316afaa9b5c11c831c668552",
    "title": "DPO Party and mass organization structure",
    "text": "The page lists the structure of the Party unit, trade union unit, women's union unit and youth executive committee at DPO. Names shown only in organizational chart images are not available in the page's text.",
    "aliases": [
      "party structure",
      "trade union structure",
      "women union",
      "youth committee",
      "ໂຄງຮ່າງສາຍພັກ"
    ]
  },
  "page:wordpress-page-1005": {
    "sourceHash": "9046e12d78c467b5f478f7af35a8e9128909f5edc359b74f2cdd38efed9a621a",
    "title": "DPO Board of Directors structure",
    "text": "The board structure page provides charts covering 1999 to the present. It lists periods for the Depositor Protection Fund's board: 1999–2003, 2003–2006, 2006–2009, 2009–2015, 2015–2017 and 2017–2018. DPO board charts are listed for 2019, 2020, 2022, 2023, 2024, September 2024–January 2025, February–August 2025, September 2025–May 2026, May–July 2026 and the current board. The page text is a chart index; names visible only in images must be checked in the original chart.",
    "aliases": [
      "board of directors",
      "board structure",
      "DPO management board",
      "ຄະນະສະພາບໍລິຫານ"
    ]
  },
  "page:wordpress-page-9": {
    "sourceHash": "30fc6ea36e38d7f99bada40dc7062a21605d4542110708f4378f21104fdb8bf3",
    "title": "Background of deposit protection in Laos",
    "text": "The website's background page describes financial crises during 1922–1980, including bank failures in the United States during 1922–1933, and the establishment of the first deposit insurance institution in the United States in 1933. It also mentions deposit insurance developments in Japan in 1971, Vietnam in 1999, Malaysia in 2005 and Thailand in 2008.\n\nFollowing the Asian financial crisis of 1997–1998, Laos established the Depositor Protection Fund in late 1999 to protect depositors' interests and strengthen confidence in the banking system. The page describes discussions between the Bank of the Lao PDR, ADB and CAFSL on 25 February 1998 and the ADB-FSPL II loan conditions. Its figure of 143 countries with deposit insurance is explicitly dated June 2019.",
    "aliases": [
      "background of deposit insurance",
      "international deposit insurance history"
    ]
  },
  "page:cmw6npu0s0000xp7mnjln5u0d": {
    "sourceHash": "cb0c93bfd4225856b0db368965ad187f26b0d49019fb38053d92854ec33f9be2",
    "title": "Deposit protection limit and member counts shown on the DPO website",
    "text": "The home page displays these figures:\n- Deposit protection limit: 100 million kip.\n- Member commercial banks: 35.\n- Deposit-taking microfinance member institutions: 6.\nThese are the figures displayed in the website's published home page content. For the applicable conditions and governing documents, check the original sources or contact DPO.",
    "aliases": [
      "how much is protected",
      "maximum insured amount",
      "coverage ceiling",
      "deposit protection limit",
      "how many member banks",
      "number of microfinance institutions",
      "ວົງເງິນປົກປ້ອງເທົ່າໃດ",
      "ສະມາຊິກຈັກທະນາຄານ",
      "ຈຳນວນສະມາຊິກ"
    ]
  }
};
