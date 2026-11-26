import { pgTable, pgEnum, uuid, varchar, text, timestamp, boolean, index, uniqueIndex, integer, jsonb } from "drizzle-orm/pg-core";
export const channel = pgEnum("channel", ["whatsapp_txt","texto_pegado","manual"]);
export const requestType = pgEnum("request_type", ["ti","asistencia","operaciones","infraestructura","seguridad","otros"]);
export const incidentStatus = pgEnum("incident_status", ["pendiente","en_atencion","resuelto","cerrado","descartado"]);
export const messageType = pgEnum("message_type", ["reporte","respuesta","seguimiento","confirmacion","otro"]);
export const profileRole = pgEnum("profile_role", ["admin","tecnico","consulta"]);
export const profiles = pgTable("profiles", {
 id:uuid("id").defaultRandom().primaryKey(), authUserId:varchar("auth_user_id",{length:180}).unique(),
 fullName:varchar("full_name",{length:180}).notNull(), email:varchar("email",{length:254}).notNull().unique(),
 role:profileRole("role").notNull().default("tecnico"), active:boolean("active").notNull().default(true),
 createdAt:timestamp("created_at",{withTimezone:true}).defaultNow().notNull(), updatedAt:timestamp("updated_at",{withTimezone:true}).defaultNow().notNull()
});
export const teachers = pgTable("teachers", {
 id:uuid("id").defaultRandom().primaryKey(), fullName:varchar("full_name",{length:180}).notNull(),
 normalizedName:varchar("normalized_name",{length:180}).notNull(), email:varchar("email",{length:254}),
 active:boolean("active").notNull().default(true), createdAt:timestamp("created_at",{withTimezone:true}).defaultNow().notNull()
},t=>({nameIdx:index("teachers_name_idx").on(t.normalizedName),emailIdx:index("teachers_email_idx").on(t.email)}));
export const teacherAliases = pgTable("teacher_aliases", {
 id:uuid("id").defaultRandom().primaryKey(), teacherId:uuid("teacher_id").notNull().references(()=>teachers.id,{onDelete:"cascade"}),
 alias:varchar("alias",{length:180}).notNull(), normalizedAlias:varchar("normalized_alias",{length:180}).notNull().unique(),
 createdAt:timestamp("created_at",{withTimezone:true}).defaultNow().notNull()
},t=>({teacherIdx:index("teacher_aliases_teacher_idx").on(t.teacherId)}));
export const categories = pgTable("categories", {
 id:uuid("id").defaultRandom().primaryKey(), name:varchar("name",{length:120}).notNull().unique(),
 group:requestType("group").notNull().default("otros"), description:text("description"),
 keywords:text("keywords").array().notNull().default([]), active:boolean("active").notNull().default(true),
 createdAt:timestamp("created_at",{withTimezone:true}).defaultNow().notNull()
});
export const imports = pgTable("chat_imports", {
 id:uuid("id").defaultRandom().primaryKey(), sourceName:varchar("source_name",{length:255}),
 channel:channel("channel").notNull(), contentHash:varchar("content_hash",{length:64}).notNull(),
 totalMessages:integer("total_messages").notNull().default(0), candidateCount:integer("candidate_count").notNull().default(0),
 importedAt:timestamp("imported_at",{withTimezone:true}).defaultNow().notNull(),
 importedBy:uuid("imported_by").references(()=>profiles.id,{onDelete:"set null"})
},t=>({hashUnique:uniqueIndex("chat_imports_hash_uq").on(t.contentHash)}));
export const incidents = pgTable("incidents", {
 id:uuid("id").defaultRandom().primaryKey(), incidentDate:timestamp("incident_date",{withTimezone:true}).notNull(),
 incidentTime:varchar("incident_time",{length:5}).notNull(), requesterName:varchar("requester_name",{length:180}).notNull(),
 teacherId:uuid("teacher_id").references(()=>teachers.id,{onDelete:"set null"}), originalMessage:text("original_message").notNull(),
 categoryId:uuid("category_id").references(()=>categories.id,{onDelete:"set null"}),
 categoryLabel:varchar("category_label",{length:120}).notNull(), requestType:requestType("request_type").notNull().default("otros"),
 status:incidentStatus("status").notNull().default("pendiente"), contextualization:text("contextualization"),
 channel:channel("channel").notNull(), importId:uuid("import_id").references(()=>imports.id,{onDelete:"set null"}),
 assignedTo:uuid("assigned_to").references(()=>profiles.id,{onDelete:"set null"}),
 resolvedAt:timestamp("resolved_at",{withTimezone:true}), createdAt:timestamp("created_at",{withTimezone:true}).defaultNow().notNull(),
 updatedAt:timestamp("updated_at",{withTimezone:true}).defaultNow().notNull()
},t=>({dateIdx:index("incidents_date_idx").on(t.incidentDate),teacherIdx:index("incidents_teacher_idx").on(t.teacherId),categoryIdx:index("incidents_category_idx").on(t.categoryId),statusIdx:index("incidents_status_idx").on(t.status),importIdx:index("incidents_import_idx").on(t.importId)}));
export const incidentMessages = pgTable("incident_messages", {
 id:uuid("id").defaultRandom().primaryKey(), incidentId:uuid("incident_id").notNull().references(()=>incidents.id,{onDelete:"cascade"}),
 senderName:varchar("sender_name",{length:180}).notNull(), messageText:text("message_text").notNull(),
 messageDate:timestamp("message_date",{withTimezone:true}).notNull(), messageTime:varchar("message_time",{length:5}).notNull(),
 type:messageType("type").notNull().default("otro"), contentHash:varchar("content_hash",{length:64}),
 isStaff:boolean("is_staff").notNull().default(false), createdAt:timestamp("created_at",{withTimezone:true}).defaultNow().notNull()
},t=>({incidentIdx:index("incident_messages_incident_idx").on(t.incidentId),hashUnique:uniqueIndex("incident_messages_hash_uq").on(t.contentHash)}));
export const incidentResponses = pgTable("incident_responses", {
 id:uuid("id").defaultRandom().primaryKey(), incidentId:uuid("incident_id").notNull().references(()=>incidents.id,{onDelete:"cascade"}),
 messageId:uuid("message_id").references(()=>incidentMessages.id,{onDelete:"set null"}),
 responderName:varchar("responder_name",{length:180}).notNull(), responseText:text("response_text").notNull(),
 responseDate:timestamp("response_date",{withTimezone:true}).notNull(), responseTime:varchar("response_time",{length:5}).notNull(),
 createdAt:timestamp("created_at",{withTimezone:true}).defaultNow().notNull()
},t=>({incidentIdx:index("incident_responses_incident_idx").on(t.incidentId)}));
export const incidentHistory = pgTable("incident_history", {
 id:uuid("id").defaultRandom().primaryKey(), incidentId:uuid("incident_id").notNull().references(()=>incidents.id,{onDelete:"cascade"}),
 actorId:uuid("actor_id").references(()=>profiles.id,{onDelete:"set null"}), action:varchar("action",{length:80}).notNull(),
 previousValue:jsonb("previous_value"), newValue:jsonb("new_value"), notes:text("notes"),
 createdAt:timestamp("created_at",{withTimezone:true}).defaultNow().notNull()
},t=>({incidentIdx:index("incident_history_incident_idx").on(t.incidentId)}));
