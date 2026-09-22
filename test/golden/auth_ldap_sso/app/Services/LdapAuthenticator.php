<?php

namespace App\Services;

use App\Models\FixzySetting;
use App\Models\User;
use LdapRecord\Connection;
use LdapRecord\Auth\BindException;
use LdapRecord\ConnectionException;

/**
 * LDAP authentication (Fixzy SysMaker generated — enabled by project
 * flag module_auth_ldap). Powered by directorytree/ldaprecord, the
 * standard LDAP library for PHP/Laravel.
 *
 * Server settings are read at runtime from the fixzy_settings table
 * (editable on the Auth Settings page) with env fallbacks, so nothing
 * is hard-coded.
 */
class LdapAuthenticator
{
    /**
     * Try to authenticate a user against the configured LDAP directory.
     *
     * Flow: bind with the service account -> search for the login name ->
     * re-bind as that user with their password -> locate/create the local
     * user record.
     *
     * @return User|null the local user on success, null on bad credentials
     * @throws \RuntimeException when the LDAP server itself is unreachable
     *         (so the caller can show a different message than "wrong password")
     */
    public function attempt(string $username, string $password): ?User
    {
        $connection = $this->connection();

        try {
            $connection->connect();
        } catch (ConnectionException $e) {
            throw new \RuntimeException('Cannot reach the LDAP server. Check the server settings (Auth Settings page).');
        }

        $usernameField = self::setting('ldap_username_field', 'uid');

        try {
            $entry = $connection->query()
                ->where($usernameField, '=', $username)
                ->first();
        } catch (\LdapRecord\LdapRecordException $e) {
            throw new \RuntimeException('LDAP search failed: ' . $e->getMessage());
        }

        if (! $entry) {
            return null;
        }

        $dn = $entry->getDn();

        try {
            $connection->auth()->attempt($dn, $password, $stayAuthenticated = false);
        } catch (BindException $e) {
            return null;
        }

        // Authenticated in LDAP — find or provision the local account.
        $email = $entry->getFirstAttribute('mail') ?: ($username . '@ldap.local');

        $user = User::query()->where('email', $email)->first();

        if (! $user) {
            $user = User::create([
                'name' => $entry->getFirstAttribute('cn') ?: $username,
                'email' => $email,
                'password' => bcrypt(bin2hex(random_bytes(16))),
            ]);
        }

        return $user;
    }

    protected function connection(): Connection
    {
        $hosts = array_filter(array_map('trim', explode(',', (string) self::setting('ldap_hosts', ''))));

        return new Connection([
            'hosts' => $hosts ?: ['localhost'],
            'port' => (int) self::setting('ldap_port', '389'),
            'base_dn' => self::setting('ldap_base_dn', ''),
            'username' => self::setting('ldap_bind_dn', ''),
            'password' => self::setting('ldap_bind_password', ''),
            'use_ssl' => filter_var(self::setting('ldap_use_ssl', 'false'), FILTER_VALIDATE_BOOLEAN),
            'use_tls' => filter_var(self::setting('ldap_use_tls', 'false'), FILTER_VALIDATE_BOOLEAN),
        ]);
    }

    protected static function setting(string $key, ?string $default = null): ?string
    {
        return FixzySetting::get($key, env(strtoupper($key), $default));
    }
}
