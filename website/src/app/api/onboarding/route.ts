import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const createClient = () => {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );
};

// GET - Fetch user's onboarding data
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Fetch onboarding data
    const { data, error } = await supabase
      .from('user_onboarding')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Error fetching onboarding data:', error);
      return NextResponse.json(
        { error: 'Failed to fetch onboarding data' },
        { status: 500 }
      );
    }

    // If no record exists, return default values
    if (!data) {
      return NextResponse.json({
        user_id: user.id,
        dashboard_tour_completed: false,
        shipment_creation_tour_completed: false,
        tracking_tour_completed: false,
        payment_tour_completed: false,
        admin_tour_completed: false,
        broker_tour_completed: false,
        driver_tour_completed: false,
        checklist_progress: {
          profile_completed: false,
          payment_method_added: false,
          first_shipment_created: false,
          first_shipment_tracked: false,
          documents_uploaded: false,
        },
        dismissed_hints: [],
        show_tours: true,
      });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH - Update user's onboarding data
export async function PATCH(request: NextRequest) {
  try {
    const supabase = createClient();
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();

    // Update onboarding data
    const { data, error } = await supabase
      .from('user_onboarding')
      .upsert({
        user_id: user.id,
        ...body,
      }, {
        onConflict: 'user_id',
      })
      .select()
      .single();

    if (error) {
      console.error('Error updating onboarding data:', error);
      return NextResponse.json(
        { error: 'Failed to update onboarding data' },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Update checklist progress
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { checklistKey, value } = await request.json();

    if (!checklistKey || typeof value !== 'boolean') {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }

    // Update specific checklist item
    const { data, error } = await supabase.rpc('update_checklist_progress', {
      p_user_id: user.id,
      p_key: checklistKey,
      p_value: value,
    });

    if (error) {
      // Fallback to manual update if RPC doesn't exist yet
      const { data: currentData } = await supabase
        .from('user_onboarding')
        .select('checklist_progress')
        .eq('user_id', user.id)
        .single();

      const updatedProgress = {
        ...(currentData?.checklist_progress || {}),
        [checklistKey]: value,
      };

      const { data: updateData, error: updateError } = await supabase
        .from('user_onboarding')
        .upsert({
          user_id: user.id,
          checklist_progress: updatedProgress,
        }, {
          onConflict: 'user_id',
        })
        .select()
        .single();

      if (updateError) {
        console.error('Error updating checklist:', updateError);
        return NextResponse.json(
          { error: 'Failed to update checklist' },
          { status: 500 }
        );
      }

      return NextResponse.json(updateData);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
