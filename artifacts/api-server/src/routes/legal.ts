import { Router, type IRouter } from "express";
import { getLegalDocument, legalDocuments, publicLegalDocument } from "../lib/legalDocuments";

const router: IRouter = Router();

router.get("/legal-documents", (_req, res): void => {
  res.json(Object.values(legalDocuments).map(publicLegalDocument));
});

router.get("/legal-documents/:documentKey", (req, res): void => {
  const document = getLegalDocument(req.params.documentKey);
  if (!document) {
    res.status(404).json({ error: "Legal document not found" });
    return;
  }
  res.json(publicLegalDocument(document));
});

export default router;