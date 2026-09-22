// Seed a demo project into the Fixzy SysMaker store for README screenshots.
// Idempotent: removes previous "TaskFlow" demo before inserting.
const { openStore } = require('../src/core/store');
const db = openStore();

function run() {
    // cleanup previous demo
    const old = db.prepare("SELECT project_id FROM projects WHERE app_title = 'TaskFlow'").get();
    if (old) {
        db.prepare('DELETE FROM projects WHERE project_id = ?').run(old.project_id);
    }

    const info = db.prepare(`INSERT INTO projects (app_title, stack_base, stack_database, stack_theme, data_delete_type, module_authorization, module_log_audit, module_fake_data, is_active)
        VALUES ('TaskFlow', 'laravel_filament', 'mysql_mariadb', 'fixzySys', 'soft', 1, 1, 1, 1)`).run();
    const pid = info.lastInsertRowid;

    const tables = [
        { name: 'clients', title: 'Clients', desc: 'Customer companies', fields: [
            ['client_name', 'Client Name', 'varchar', 150, 1],
            ['industry', 'Industry', 'varchar', 100, 0],
            ['contact_email', 'Contact Email', 'varchar', 150, 0],
            ['status', 'Status', 'varchar', 30, 0],
        ]},
        { name: 'projects', title: 'Projects', desc: 'Client engagements', fields: [
            ['project_name', 'Project Name', 'varchar', 150, 1],
            ['client_id', 'Client', 'varchar', 30, 0],
            ['budget', 'Budget', 'decimal', 0, 0],
            ['start_date', 'Start Date', 'date', 0, 0],
            ['status', 'Status', 'varchar', 30, 0],
        ]},
        { name: 'tasks', title: 'Tasks', desc: 'Work items', fields: [
            ['task_title', 'Task Title', 'varchar', 200, 1],
            ['project_id', 'Project', 'varchar', 30, 0],
            ['priority', 'Priority', 'varchar', 20, 0],
            ['due_date', 'Due Date', 'date', 0, 0],
            ['done', 'Done', 'tinyint', 0, 0],
        ]},
        { name: 'team_members', title: 'Team Members', desc: 'People on the team', fields: [
            ['full_name', 'Full Name', 'varchar', 120, 1],
            ['role', 'Role', 'varchar', 60, 0],
            ['email', 'Email', 'varchar', 150, 0],
        ]},
    ];

    const tableIds = {};
    let tOrder = 1;
    for (const t of tables) {
        const tid = db.prepare('INSERT INTO tables (project_id, table_name, table_view_title, table_description, table_order) VALUES (?,?,?,?,?)')
            .run(pid, t.name, t.title, t.desc, tOrder++).lastInsertRowid;
        tableIds[t.name] = tid;
        let fOrder = 1;
        for (const [fname, cap, dtype, len, req] of t.fields) {
            db.prepare('INSERT INTO fields (table_id, field_name, caption, data_type, length, required, field_order) VALUES (?,?,?,?,?,?,?)')
                .run(tid, fname, cap, dtype, len || 255, req, fOrder++);
        }
    }

    // relationships: clients 1-m projects, projects 1-m tasks
    db.prepare('INSERT INTO parent_child_relationships (parent_table_id, child_table_id, fk_child_field, parent_field, relationship_type, tab_title) VALUES (?,?,?,?,?,?)')
        .run(tableIds.clients, tableIds.projects, 'client_id', 'id', 'one-to-many', 'Projects');
    db.prepare('INSERT INTO parent_child_relationships (parent_table_id, child_table_id, fk_child_field, parent_field, relationship_type, tab_title) VALUES (?,?,?,?,?,?)')
        .run(tableIds.projects, tableIds.tasks, 'project_id', 'id', 'one-to-many', 'Tasks');

    // menu groups
    db.prepare('INSERT INTO menu_groups (project_id, group_name, group_order) VALUES (?,?,?)').run(pid, 'Business', 1);
    db.prepare('INSERT INTO menu_groups (project_id, group_name, group_order) VALUES (?,?,?)').run(pid, 'Team', 2);
    const mgBiz = db.prepare('SELECT menu_group_id FROM menu_groups WHERE project_id=? AND group_name=?').get(pid, 'Business').menu_group_id;
    const mgTeam = db.prepare('SELECT menu_group_id FROM menu_groups WHERE project_id=? AND group_name=?').get(pid, 'Team').menu_group_id;
    db.prepare('INSERT INTO menu_items (project_id, menu_group_id, table_id, item_label, item_order) VALUES (?,?,?,?,?)').run(pid, mgBiz, tableIds.clients, 'Clients', 1);
    db.prepare('INSERT INTO menu_items (project_id, menu_group_id, table_id, item_label, item_order) VALUES (?,?,?,?,?)').run(pid, mgBiz, tableIds.projects, 'Projects', 2);
    db.prepare('INSERT INTO menu_items (project_id, menu_group_id, table_id, item_label, item_order) VALUES (?,?,?,?,?)').run(pid, mgBiz, tableIds.tasks, 'Tasks', 3);
    db.prepare('INSERT INTO menu_items (project_id, menu_group_id, table_id, item_label, item_order) VALUES (?,?,?,?,?)').run(pid, mgTeam, tableIds.team_members, 'Team Members', 1);

    // dashboard widgets
    db.prepare(`INSERT INTO project_widgets (project_id, title, widget_type, target_table, target_field, aggregate_type, width_span, icon, color, sort_order)
        VALUES (?,?,?,?,?,?,?,?,?,?)`).run(pid, 'Total Projects', 'stats', 'projects', 'id', 'count', '1', 'heroicon-o-clipboard', 'primary', 1);
    db.prepare(`INSERT INTO project_widgets (project_id, title, widget_type, target_table, target_field, aggregate_type, width_span, icon, color, sort_order)
        VALUES (?,?,?,?,?,?,?,?,?,?)`).run(pid, 'Open Tasks', 'stats', 'tasks', 'id', 'count', '1', 'heroicon-o-check-circle', 'warning', 2);
    db.prepare(`INSERT INTO project_widgets (project_id, title, widget_type, target_table, target_field, aggregate_type, width_span, icon, color, sort_order)
        VALUES (?,?,?,?,?,?,?,?,?,?)`).run(pid, 'Clients by Industry', 'chart', 'clients', 'industry', 'count', '2', 'heroicon-o-chart-bar', 'success', 3);

    console.log('Seeded TaskFlow project id=' + pid);
    console.log('tables:', JSON.stringify(tableIds));
}
run();
